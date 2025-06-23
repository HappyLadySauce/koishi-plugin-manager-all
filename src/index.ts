import { Context, Schema, Logger, h } from 'koishi'

export const name = 'manager-all'

// 配置接口定义
export interface Config {
  groupManagement: {
    autoApprove: boolean
    useWhitelist: boolean
    useKeywordFilter: boolean
    welcomeMessage: string
  }
  whitelist: string[]
  approvalKeywords: string[]
  rejectionKeywords: string[]
  messageMonitor: {
    enabled: boolean
    logLevel: 'info' | 'warn' | 'error'
  }
}

// 配置模式定义
export const Config: Schema<Config> = Schema.object({
  groupManagement: Schema.object({
    autoApprove: Schema.boolean().default(false).description('是否启用自动审批'),
    useWhitelist: Schema.boolean().default(true).description('是否启用白名单检查'),
    useKeywordFilter: Schema.boolean().default(true).description('是否启用关键词过滤'),
    welcomeMessage: Schema.string().default('欢迎新朋友加入！请仔细阅读群公告。').description('欢迎消息')
  }).description('群组管理设置'),
  whitelist: Schema.array(String).default([]).description('QQ号白名单'),
  approvalKeywords: Schema.array(String).default(['朋友推荐', '学习交流']).description('自动通过关键词'),
  rejectionKeywords: Schema.array(String).default(['广告', '营销', '推广']).description('自动拒绝关键词'),
  messageMonitor: Schema.object({
    enabled: Schema.boolean().default(true).description('是否启用消息监控'),
    logLevel: Schema.union(['info', 'warn', 'error']).default('info').description('日志级别')
  }).description('消息监控设置')
})

const logger = new Logger('manager-all')

export function apply(ctx: Context, config: Config) {
  
  // 中间件：消息监控
  ctx.middleware(async (session, next) => {
    const { guildId, userId, content } = session

    // 消息监控
    if (config.messageMonitor.enabled && guildId) {
      const logData = {
        群组: guildId,
        用户: userId,
        内容: content?.slice(0, 100) + (content?.length > 100 ? '...' : ''),
        时间: new Date().toISOString()
      }

      if (config.messageMonitor.logLevel === 'info') {
        logger.info('消息监控:', JSON.stringify(logData, null, 2))
      }

      // 违规内容检测
      if (content && config.rejectionKeywords.some(keyword => content.includes(keyword))) {
        logger.warn(`检测到可疑内容: 群${guildId} 用户${userId} - ${content.slice(0, 50)}`)
      }
    }

    // 特殊消息处理
    if (content === 'ping') {
      await session.send('pong')
      return
    }

    if (content === 'help' || content === '帮助') {
      const helpMessage = [
        '🤖 Manager-All 群管机器人',
        '',
        '📋 白名单管理:',
        '• whitelist - 查看白名单帮助',
        '• whitelist.add <QQ号> - 添加单个白名单',
        '• whitelist.batch <QQ号列表> - 批量添加白名单',
        '• whitelist.remove <QQ号> - 移除白名单',
        '• whitelist.list - 查看白名单',
        '',
        '🔑 关键词管理:',
        '• keywords - 查看关键词帮助',
        '• keywords.approval.add <关键词> - 添加通过关键词',
        '• keywords.rejection.add <关键词> - 添加拒绝关键词',
        '',
        '👥 群组管理:',
        '• group.info - 查看群组信息',
        '• group.config - 查看配置',
        '',
        '🛠️ 其他功能:',
        '• ping - 测试响应',
        '• help - 显示此帮助'
      ].join('\n')
      
      await session.send(helpMessage)
      return
    }

    return next()
  })

  // 入群申请处理（支持多种事件名称）
  const handleGroupRequest = async (session: any) => {
    const guildId = session.guildId || session.groupId
    const userId = session.userId || session.user_id
    const messageId = session.messageId || session.flag
    
    logger.info(`收到入群申请: 用户 ${userId} 申请加入群 ${guildId}`)
    logger.info(`申请消息: ${session.content || session.comment || '无'}`)
    
    if (!config.groupManagement.autoApprove) {
      logger.info('自动审批功能已禁用')
      return
    }

    let shouldApprove = false
    let reason = ''

    // 白名单检查
    if (config.groupManagement.useWhitelist && config.whitelist.includes(userId)) {
      shouldApprove = true
      reason = '白名单用户'
    }

    // 关键词过滤（如果申请消息包含内容）
    const message = session.content || session.comment || ''
    if (config.groupManagement.useKeywordFilter && message) {
      if (config.rejectionKeywords.some(keyword => message.includes(keyword))) {
        shouldApprove = false
        reason = '包含拒绝关键词'
      } else if (config.approvalKeywords.some(keyword => message.includes(keyword))) {
        shouldApprove = true
        reason = '包含通过关键词'
      }
    }

    try {
      if (shouldApprove) {
        // 尝试不同的审批方法
        if (session.approve) {
          await session.approve()
        } else if (session.bot.handleGuildRequest) {
          await session.bot.handleGuildRequest(messageId, true)
        } else if (session.bot.setGroupAddRequest) {
          await session.bot.setGroupAddRequest(messageId, true)
        }
        
        logger.info(`自动通过入群申请: 用户 ${userId} (${reason})`)
        
        // 发送欢迎消息
        if (config.groupManagement.welcomeMessage) {
          setTimeout(async () => {
            try {
              await session.bot.sendMessage(guildId, config.groupManagement.welcomeMessage)
            } catch (error) {
              logger.error('发送欢迎消息失败:', error)
            }
          }, 2000)
        }
      } else if (reason) {
        // 拒绝申请
        if (session.reject) {
          await session.reject()
        } else if (session.bot.handleGuildRequest) {
          await session.bot.handleGuildRequest(messageId, false)
        } else if (session.bot.setGroupAddRequest) {
          await session.bot.setGroupAddRequest(messageId, false)
        }
        
        logger.info(`自动拒绝入群申请: 用户 ${userId} (${reason})`)
      } else {
        logger.info(`入群申请未自动处理: 用户 ${userId} (无匹配规则)`)
      }
    } catch (error) {
      logger.error(`处理入群申请失败: ${error}`)
    }
  }

  // 监听正确的入群申请事件
  ctx.on('guild-member-request', handleGroupRequest)
  
  // 兼容其他可能的事件名称
  try {
    ctx.on('guild-request' as any, handleGroupRequest)
  } catch (e) {
    logger.debug('guild-request 事件不支持')
  }
  
  // 兼容 OneBot 的中间件处理
  ctx.middleware((session, next) => {
    // 处理 OneBot 的请求事件格式
    if (session.type === 'request' && session.subtype === 'add') {
      handleGroupRequest(session)
      return
    }
    return next()
  })

  // 成员变动事件监听
  ctx.on('guild-member-added', async (session) => {
    const { guildId, userId } = session
    logger.info(`新成员加入: 群 ${guildId}, 用户 ${userId}`)
    
    if (config.groupManagement.welcomeMessage) {
      try {
        await session.send(h.at(userId) + ' ' + config.groupManagement.welcomeMessage)
      } catch (error) {
        logger.error('发送欢迎消息失败:', error)
      }
    }
  })

  ctx.on('guild-member-removed', async (session) => {
    const { guildId, userId } = session
    logger.info(`成员离开: 群 ${guildId}, 用户 ${userId}`)
  })

  // 白名单管理命令
  ctx.command('whitelist', '白名单管理')
    .action(async () => {
      const helpMessage = [
        '📋 白名单管理命令:',
        '',
        '➕ 添加操作:',
        '• whitelist.add <QQ号> - 添加单个白名单',
        '• whitelist.batch <QQ号列表> - 批量添加白名单',
        '• whitelist.import - 从当前群组导入成员',
        '',
        '➖ 移除操作:',
        '• whitelist.remove <QQ号> - 移除白名单',
        '• whitelist.clear - 清空白名单',
        '',
        '📄 查看操作:',
        '• whitelist.list - 查看白名单列表',
        '',
        '📊 批量添加示例:',
        '• whitelist.batch 123,456,789',
        '• whitelist.batch 123 456 789',
        '',
        `当前白名单状态: ${config.groupManagement.useWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `白名单数量: ${config.whitelist.length} 个`
      ].join('\n')
      
      return helpMessage
    })

  ctx.command('whitelist.add <qq:string>', '添加白名单')
    .action(async (_, qq) => {
      if (!qq || !/^\d+$/.test(qq)) {
        return '❌ 请提供有效的QQ号'
      }

      if (config.whitelist.includes(qq)) {
        return '⚠️ 该QQ号已在白名单中'
      }

      config.whitelist.push(qq)
      return `✅ 已将 ${qq} 添加到白名单`
    })

  ctx.command('whitelist.batch <qqs:text>', '批量添加白名单')
    .example('whitelist.batch 123456789,987654321,555666777')
    .example('whitelist.batch 123456789 987654321 555666777')
    .action(async (_, qqs) => {
      if (!qqs) {
        return [
          '❌ 请提供QQ号列表',
          '',
          '📋 支持格式:',
          '• 逗号分隔: whitelist.batch 123,456,789',
          '• 空格分隔: whitelist.batch 123 456 789',
          '• 换行分隔: 支持多行输入'
        ].join('\n')
      }

      // 支持多种分隔符：逗号、空格、换行
      const qqList = qqs
        .split(/[,\s\n]+/)
        .map(qq => qq.trim())
        .filter(qq => qq.length > 0)

      if (qqList.length === 0) {
        return '❌ 未检测到有效的QQ号'
      }

      const results = {
        success: [] as string[],
        invalid: [] as string[],
        duplicate: [] as string[]
      }

      // 验证并分类QQ号
      qqList.forEach(qq => {
        if (!/^\d+$/.test(qq)) {
          results.invalid.push(qq)
        } else if (config.whitelist.includes(qq)) {
          results.duplicate.push(qq)
        } else {
          results.success.push(qq)
          config.whitelist.push(qq)
        }
      })

      // 生成结果报告
      const report = []
      report.push('📊 批量添加白名单结果:')
      report.push('')

      if (results.success.length > 0) {
        report.push(`✅ 成功添加 ${results.success.length} 个:`)
        report.push(results.success.map(qq => `• ${qq}`).join('\n'))
        report.push('')
      }

      if (results.duplicate.length > 0) {
        report.push(`⚠️ 已存在 ${results.duplicate.length} 个:`)
        report.push(results.duplicate.map(qq => `• ${qq}`).join('\n'))
        report.push('')
      }

      if (results.invalid.length > 0) {
        report.push(`❌ 无效格式 ${results.invalid.length} 个:`)
        report.push(results.invalid.map(qq => `• ${qq}`).join('\n'))
        report.push('')
      }

      report.push(`📋 当前白名单总数: ${config.whitelist.length}`)

      return report.join('\n')
    })

  ctx.command('whitelist.import', '从当前群组导入成员')
    .option('limit', '-l <count:number> 限制导入数量', { fallback: 50 })
    .option('exclude-bot', '-e 排除机器人账号', { fallback: true })
    .action(async ({ session, options }) => {
      if (!session.guildId) {
        return '❌ 此命令只能在群组中使用'
      }

      try {
        const bot = session.bot
        
        // 获取群成员列表
        const guild = await bot.getGuild(session.guildId)
        if (!guild) {
          return '❌ 无法获取群组信息'
        }

        // 尝试获取成员列表（不同适配器可能有不同的方法）
        let members: any[] = []
        
        try {
          // 尝试标准方法
          const memberList = await bot.getGuildMemberList(session.guildId)
          members = memberList.data || []
        } catch (e) {
          // 如果标准方法失败，提示手动输入
          return [
            '❌ 无法自动获取群成员列表',
            '',
            '💡 请手动使用批量添加功能:',
            '• whitelist.batch <QQ号列表>',
            '',
            '📋 支持格式:',
            '• 逗号分隔: 123,456,789',
            '• 空格分隔: 123 456 789'
          ].join('\n')
        }

        if (members.length === 0) {
          return '❌ 获取到的成员列表为空'
        }

        const results = {
          success: [] as string[],
          duplicate: [] as string[],
          excluded: [] as string[]
        }

        let processedCount = 0
        
        for (const member of members) {
          if (processedCount >= options.limit) break
          
          const userId = member.user?.id || member.userId || member.user_id
          if (!userId) continue

          // 排除机器人账号
          if (options['exclude-bot'] && (member.user?.isBot || member.is_bot || userId === bot.selfId)) {
            results.excluded.push(userId)
            continue
          }

          if (config.whitelist.includes(userId)) {
            results.duplicate.push(userId)
          } else {
            config.whitelist.push(userId)
            results.success.push(userId)
          }
          
          processedCount++
        }

        // 生成结果报告
        const report = []
        report.push('📊 群成员导入白名单结果:')
        report.push('')
        report.push(`👥 群组: ${guild.name || session.guildId}`)
        report.push(`📝 处理成员: ${processedCount} / ${members.length}`)
        report.push('')

        if (results.success.length > 0) {
          report.push(`✅ 成功导入 ${results.success.length} 个`)
          if (results.success.length <= 10) {
            report.push(results.success.map(id => `• ${id}`).join('\n'))
          } else {
            report.push(`• ${results.success.slice(0, 5).join(', ')} ... (共${results.success.length}个)`)
          }
          report.push('')
        }

        if (results.duplicate.length > 0) {
          report.push(`⚠️ 已存在 ${results.duplicate.length} 个`)
          report.push('')
        }

        if (results.excluded.length > 0) {
          report.push(`🤖 排除机器人 ${results.excluded.length} 个`)
          report.push('')
        }

        report.push(`📋 当前白名单总数: ${config.whitelist.length}`)

        return report.join('\n')

      } catch (error) {
        logger.error('导入群成员失败:', error)
        return [
          '❌ 导入群成员失败',
          '',
          '💡 请尝试手动批量添加:',
          '• whitelist.batch <QQ号列表>'
        ].join('\n')
      }
    })

  ctx.command('whitelist.remove <qq:string>', '移除白名单')
    .action(async (_, qq) => {
      if (!qq) {
        return '❌ 请提供QQ号'
      }

      const index = config.whitelist.indexOf(qq)
      if (index === -1) {
        return '⚠️ 该QQ号不在白名单中'
      }

      config.whitelist.splice(index, 1)
      return `✅ 已将 ${qq} 从白名单移除`
    })

  ctx.command('whitelist.list', '查看白名单')
    .action(async () => {
      if (config.whitelist.length === 0) {
        return '📋 白名单为空'
      }

      const list = config.whitelist.map((qq, index) => `${index + 1}. ${qq}`).join('\n')
      return `📋 白名单列表 (${config.whitelist.length} 个):\n\n${list}`
    })

  ctx.command('whitelist.clear', '清空白名单')
    .action(async () => {
      const count = config.whitelist.length
      config.whitelist.length = 0
      return `✅ 已清空白名单 (移除了 ${count} 个QQ号)`
    })

  // 关键词管理命令
  ctx.command('keywords', '关键词管理')
    .action(async () => {
      const helpMessage = [
        '🔑 关键词管理命令:',
        '',
        '📈 通过关键词:',
        '• keywords.approval.add <关键词> - 添加通过关键词',
        '• keywords.approval.remove <关键词> - 移除通过关键词',
        '• keywords.approval.list - 查看通过关键词',
        '',
        '📉 拒绝关键词:',
        '• keywords.rejection.add <关键词> - 添加拒绝关键词',
        '• keywords.rejection.remove <关键词> - 移除拒绝关键词',
        '• keywords.rejection.list - 查看拒绝关键词',
        '',
        '• keywords.list - 查看所有关键词',
        '',
        `关键词过滤状态: ${config.groupManagement.useKeywordFilter ? '✅ 启用' : '❌ 禁用'}`
      ].join('\n')
      
      return helpMessage
    })

  // 通过关键词管理
  ctx.command('keywords.approval.add <keyword:text>', '添加通过关键词')
    .action(async (_, keyword) => {
      if (!keyword) {
        return '❌ 请提供关键词'
      }

      if (config.approvalKeywords.includes(keyword)) {
        return '⚠️ 该关键词已存在'
      }

      config.approvalKeywords.push(keyword)
      return `✅ 已添加通过关键词: ${keyword}`
    })

  ctx.command('keywords.approval.remove <keyword:text>', '移除通过关键词')
    .action(async (_, keyword) => {
      if (!keyword) {
        return '❌ 请提供关键词'
      }

      const index = config.approvalKeywords.indexOf(keyword)
      if (index === -1) {
        return '⚠️ 该关键词不存在'
      }

      config.approvalKeywords.splice(index, 1)
      return `✅ 已移除通过关键词: ${keyword}`
    })

  ctx.command('keywords.approval.list', '查看通过关键词')
    .action(async () => {
      if (config.approvalKeywords.length === 0) {
        return '📈 通过关键词列表为空'
      }

      const list = config.approvalKeywords.map((kw, index) => `${index + 1}. ${kw}`).join('\n')
      return `📈 通过关键词列表 (${config.approvalKeywords.length} 个):\n\n${list}`
    })

  // 拒绝关键词管理
  ctx.command('keywords.rejection.add <keyword:text>', '添加拒绝关键词')
    .action(async (_, keyword) => {
      if (!keyword) {
        return '❌ 请提供关键词'
      }

      if (config.rejectionKeywords.includes(keyword)) {
        return '⚠️ 该关键词已存在'
      }

      config.rejectionKeywords.push(keyword)
      return `✅ 已添加拒绝关键词: ${keyword}`
    })

  ctx.command('keywords.rejection.remove <keyword:text>', '移除拒绝关键词')
    .action(async (_, keyword) => {
      if (!keyword) {
        return '❌ 请提供关键词'
      }

      const index = config.rejectionKeywords.indexOf(keyword)
      if (index === -1) {
        return '⚠️ 该关键词不存在'
      }

      config.rejectionKeywords.splice(index, 1)
      return `✅ 已移除拒绝关键词: ${keyword}`
    })

  ctx.command('keywords.rejection.list', '查看拒绝关键词')
    .action(async () => {
      if (config.rejectionKeywords.length === 0) {
        return '📉 拒绝关键词列表为空'
      }

      const list = config.rejectionKeywords.map((kw, index) => `${index + 1}. ${kw}`).join('\n')
      return `📉 拒绝关键词列表 (${config.rejectionKeywords.length} 个):\n\n${list}`
    })

  ctx.command('keywords.list', '查看所有关键词')
    .action(async () => {
      const approvalList = config.approvalKeywords.length > 0 
        ? config.approvalKeywords.map(kw => `✅ ${kw}`).join('\n')
        : '(无)'
        
      const rejectionList = config.rejectionKeywords.length > 0
        ? config.rejectionKeywords.map(kw => `❌ ${kw}`).join('\n')
        : '(无)'

      return [
        '🔑 所有关键词列表:',
        '',
        '📈 通过关键词:',
        approvalList,
        '',
        '📉 拒绝关键词:',
        rejectionList,
        '',
        `过滤状态: ${config.groupManagement.useKeywordFilter ? '✅ 启用' : '❌ 禁用'}`
      ].join('\n')
    })

  // 群组管理命令
  ctx.command('group.info', '查看群组信息')
    .action(async ({ session }) => {
      if (!session.guildId) {
        return '❌ 此命令只能在群组中使用'
      }

      try {
        const guild = await session.bot.getGuild(session.guildId)
        
        if (guild) {
          return [
            '👥 群组信息:',
            '',
            `📛 群名称: ${guild.name || '未知'}`,
            `🆔 群号: ${guild.id}`,
            `👤 成员数: 未知`,
            `🤖 机器人状态: ✅ 在线`
          ].join('\n')
        } else {
          return '❌ 无法获取群组信息'
        }
      } catch (error) {
        logger.error('获取群组信息失败:', error)
        return '❌ 获取群组信息失败'
      }
    })

  ctx.command('group.config', '查看群管配置')
    .action(async () => {
      return [
        '⚙️ 群管配置状态:',
        '',
        `🔄 自动审批: ${config.groupManagement.autoApprove ? '✅ 启用' : '❌ 禁用'}`,
        `📋 白名单检查: ${config.groupManagement.useWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `🔑 关键词过滤: ${config.groupManagement.useKeywordFilter ? '✅ 启用' : '❌ 禁用'}`,
        `📝 消息监控: ${config.messageMonitor.enabled ? '✅ 启用' : '❌ 禁用'}`,
        '',
        `📊 统计信息:`,
        `• 白名单数量: ${config.whitelist.length}`,
        `• 通过关键词: ${config.approvalKeywords.length}`,
        `• 拒绝关键词: ${config.rejectionKeywords.length}`,
        '',
        `💬 欢迎消息: ${config.groupManagement.welcomeMessage || '(未设置)'}`
      ].join('\n')
    })

  // 监控设置命令
  ctx.command('monitor.toggle', '切换消息监控状态')
    .action(async () => {
      config.messageMonitor.enabled = !config.messageMonitor.enabled
      return `📝 消息监控已${config.messageMonitor.enabled ? '启用' : '禁用'}`
    })

  ctx.command('monitor.level <level:string>', '设置监控日志级别')
    .action(async (_, level) => {
      if (!['info', 'warn', 'error'].includes(level)) {
        return '❌ 无效的日志级别，请使用: info, warn, error'
      }

      config.messageMonitor.logLevel = level as 'info' | 'warn' | 'error'
      return `📝 监控日志级别已设置为: ${level}`
    })

  // 插件状态命令
  ctx.command('manager.status', '查看插件状态')
    .action(async () => {
      return [
        '🤖 Manager-All 插件状态:',
        '',
        '📊 功能模块状态:',
        `• 消息监控: ${config.messageMonitor.enabled ? '✅ 运行中' : '❌ 已禁用'}`,
        `• 白名单管理: ${config.groupManagement.useWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `• 关键词过滤: ${config.groupManagement.useKeywordFilter ? '✅ 启用' : '❌ 禁用'}`,
        `• 自动审批: ${config.groupManagement.autoApprove ? '✅ 启用' : '❌ 禁用'}`,
        '',
        '📈 数据统计:',
        `• 白名单用户: ${config.whitelist.length} 个`,
        `• 通过关键词: ${config.approvalKeywords.length} 个`,
        `• 拒绝关键词: ${config.rejectionKeywords.length} 个`,
        '',
        '🔧 配置信息:',
        `• 日志级别: ${config.messageMonitor.logLevel}`,
        `• 欢迎消息: ${config.groupManagement.welcomeMessage ? '已设置' : '未设置'}`,
        '',
        '📋 使用 help 命令查看完整功能列表'
      ].join('\n')
    })

  // 调试命令
  ctx.command('manager.debug', '开启调试模式')
    .action(async () => {
      // 添加全局事件监听器用于调试
      const originalOn = ctx.on.bind(ctx)
      
      // 监听所有可能的事件
      const eventNames = [
        'request', 'guild-request', 'friend-request', 'group-request',
        'request/group', 'request/group/add', 'request/friend',
        'guild-member-request', 'group-member-request'
      ]
      
      eventNames.forEach(eventName => {
        try {
          ctx.on(eventName as any, (session: any) => {
            logger.info(`📡 捕获到事件: ${eventName}`)
            logger.info(`📋 事件详情: ${JSON.stringify({
              type: session.type,
              subtype: session.subtype,
              userId: session.userId,
              guildId: session.guildId,
              content: session.content,
              messageId: session.messageId,
              platform: session.platform
            }, null, 2)}`)
          })
        } catch (e) {
          logger.debug(`❌ 事件 ${eventName} 不支持`)
        }
      })
      
      // 使用中间件监听所有原始事件
      ctx.middleware((session, next) => {
        // 记录所有非消息事件
        if (session.type && session.type !== 'message') {
          logger.info(`🔍 中间件捕获非消息事件: type=${session.type}, subtype=${session.subtype || '无'}`)
          logger.info(`📊 完整 session 信息:`)
          logger.info(`  - platform: ${session.platform}`)
          logger.info(`  - type: ${session.type}`)
          logger.info(`  - subtype: ${session.subtype}`)
          logger.info(`  - userId: ${session.userId}`)
          logger.info(`  - guildId: ${session.guildId}`)
          logger.info(`  - content: ${session.content}`)
          logger.info(`  - messageId: ${session.messageId}`)
          
          // 如果是请求类型事件，特别处理
          if (session.type === 'request') {
            logger.info(`🎯 发现请求事件! subtype: ${session.subtype}`)
            if (session.subtype === 'add' || session.subtype === 'group') {
              logger.info(`✅ 这可能是入群申请事件!`)
              handleGroupRequest(session)
            }
          }
        }
        return next()
      })
      
      return [
        '🔧 调试模式已开启',
        '',
        '现在会记录所有可能的入群申请相关事件',
        '请尝试发送入群申请，查看控制台日志',
        '',
        '监听的事件类型:',
        eventNames.map(name => `• ${name}`).join('\n'),
        '',
        '同时监听所有中间件事件，特别关注 type=request 的事件'
      ].join('\n')
    })

  logger.info('Manager-All 插件加载完成')
  logger.info(`当前配置: 自动审批=${config.groupManagement.autoApprove}, 白名单=${config.groupManagement.useWhitelist}, 关键词过滤=${config.groupManagement.useKeywordFilter}`)
}
