import { Context, Logger, h } from 'koishi'
import { Config as ConfigType } from './types'
import { ConfigSchema } from './config/schema'
import { KoishiDatabaseService, DatabaseService } from './database'
import { GroupRequestHandler } from './handlers/group-request'
import { RuleEngine } from './handlers/rule-engine'
import { WhitelistCommandHandler } from './commands/whitelist'
import { NamesCommandHandler } from './commands/names'
import { RulesCommandHandler } from './commands/rules'

export const name = 'group-master'
export type Config = ConfigType
export const Config = ConfigSchema

const logger = new Logger('group-master')

export function apply(ctx: Context, config: Config) {
  let database: DatabaseService | undefined
  
  // 初始化数据库（如果启用）
  if (config.database.enabled) {
    try {
      database = new KoishiDatabaseService(ctx)
      if (database.initTables) {
        database.initTables().catch(error => {
          logger.error('初始化数据库表失败:', error)
        })
      }
      logger.info('数据库服务已启用')
    } catch (error) {
      logger.warn('初始化数据库服务失败，将使用配置文件存储:', error)
    }
  }

  // 初始化规则引擎和请求处理器
  const ruleEngine = new RuleEngine(config, database)
  const requestHandler = new GroupRequestHandler(ctx, config, database, ruleEngine)

  // 初始化命令处理器
  const whitelistCommands = new WhitelistCommandHandler(ctx, config, database)
  const namesCommands = new NamesCommandHandler(ctx, config, database)
  const rulesCommands = new RulesCommandHandler(ctx, config, database)

  // 注册命令
  whitelistCommands.register()
  namesCommands.register()
  rulesCommands.register()

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
        '🤖 Group-Master 群管机器人',
        '',
        '📋 QQ号白名单管理:',
        '• whitelist - 查看QQ号白名单帮助',
        '• whitelist.add <QQ号> - 添加单个QQ号白名单',
        '• whitelist.batch <QQ号列表> - 批量添加QQ号白名单',
        '• whitelist.remove <QQ号> - 移除QQ号白名单',
        '• whitelist.list - 查看QQ号白名单',
        '• whitelist.reject-toggle - 切换自动拒绝功能',
        '',
        '👤 姓名白名单管理:',
        '• names - 查看姓名白名单帮助',
        '• names.add <姓名> - 添加单个姓名',
        '• names.batch <姓名列表> - 批量添加姓名',
        '• names.remove <姓名> - 移除姓名',
        '• names.list - 查看姓名白名单',
        '• names.validation-toggle - 切换严格姓名验证模式',
        '',
        '🔧 通用规则管理:',
        '• rules - 查看规则管理帮助',
        '• rules.list - 查看规则列表',
        '• rules.create - 创建新规则',
        '• rules.preset.whitelist - 创建白名单规则',
        '• rules.preset.names - 创建姓名验证规则',
        '• rules.preset.keywords <关键词> - 创建关键词规则',
        '',
        '👥 群组管理:',
        '• group.info - 查看群组信息',
        '• group.config - 查看配置',
        '',
        '💬 消息管理:',
        '• message - 查看消息管理帮助',
        '• message.welcome.set <消息> - 设置欢迎消息',
        '• message.welcome.toggle - 启用/禁用欢迎功能',
        '• message.rejection.set <消息> - 设置拒绝消息',
        '',
        '🛠️ 其他功能:',
        '• ping - 测试响应',
        '• master.status - 查看插件状态',
        '• help - 显示此帮助'
      ].join('\n')
      
      await session.send(helpMessage)
      return
    }

    return next()
  })

  // 入群申请处理（支持多种事件名称）
  const handleGroupRequest = (session: any) => {
    requestHandler.handleGroupRequest(session)
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
    
    if (config.groupManagement.enableWelcome && config.groupManagement.welcomeMessage) {
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

  // 基础配置命令
  ctx.command('group.config', '查看群管配置')
    .action(async () => {
      return [
        '⚙️ 群管配置状态:',
        '',
        `🔄 自动审批: ${config.groupManagement.autoApprove ? '✅ 启用' : '❌ 禁用'}`,
        `👤 严格姓名验证: ${config.groupManagement.useNameValidation ? '✅ 启用' : '❌ 禁用'}`,
        `📋 QQ号白名单检查: ${config.groupManagement.useWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `🚫 自动拒绝非白名单: ${config.groupManagement.autoRejectNonWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `🔑 关键词过滤: ${config.groupManagement.useKeywordFilter ? '✅ 启用' : '❌ 禁用'}`,
        `💬 入群欢迎: ${config.groupManagement.enableWelcome ? '✅ 启用' : '❌ 禁用'}`,
        `📝 消息监控: ${config.messageMonitor.enabled ? '✅ 启用' : '❌ 禁用'}`,
        `💾 数据库存储: ${config.database.enabled ? '✅ 启用' : '❌ 禁用'}`,
        '',
        `📊 统计信息:`,
        `• QQ号白名单数量: ${config.whitelist.length}`,
        `• 姓名白名单数量: ${config.nameWhitelist.length}`,
        `• 通过关键词: ${config.approvalKeywords.length}`,
        `• 拒绝关键词: ${config.rejectionKeywords.length}`,
        '',
        `💬 消息配置:`,
        `• 欢迎消息: ${config.groupManagement.welcomeMessage || '(未设置)'}`,
        `• 拒绝消息: ${config.groupManagement.rejectionMessage || '(未设置)'}`,
        `• 姓名验证失败消息: ${config.groupManagement.nameValidationMessage || '(未设置)'}`,
        '',
        config.groupManagement.useNameValidation 
          ? '🔥 当前启用严格姓名验证模式，只有白名单中的姓名才能通过！'
          : '💡 可使用 names.validation-toggle 启用严格姓名验证模式'
      ].join('\n')
    })

  // 插件状态命令
  ctx.command('master.status', '查看插件状态')
    .action(async () => {
      return [
        '🤖 Group-Master 插件状态:',
        '',
        '📊 功能模块状态:',
        `• 消息监控: ${config.messageMonitor.enabled ? '✅ 运行中' : '❌ 已禁用'}`,
        `• 严格姓名验证: ${config.groupManagement.useNameValidation ? '✅ 启用' : '❌ 禁用'}`,
        `• QQ号白名单管理: ${config.groupManagement.useWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `• 自动拒绝非白名单: ${config.groupManagement.autoRejectNonWhitelist ? '✅ 启用' : '❌ 禁用'}`,
        `• 关键词过滤: ${config.groupManagement.useKeywordFilter ? '✅ 启用' : '❌ 禁用'}`,
        `• 入群欢迎: ${config.groupManagement.enableWelcome ? '✅ 启用' : '❌ 禁用'}`,
        `• 自动审批: ${config.groupManagement.autoApprove ? '✅ 启用' : '❌ 禁用'}`,
        `• 数据库存储: ${database ? '✅ 已连接' : '❌ 未启用'}`,
        '',
        '📈 数据统计:',
        `• QQ号白名单: ${config.whitelist.length} 个`,
        `• 姓名白名单: ${config.nameWhitelist.length} 个`,
        `• 通过关键词: ${config.approvalKeywords.length} 个`,
        `• 拒绝关键词: ${config.rejectionKeywords.length} 个`,
        '',
        '🔧 配置信息:',
        `• 日志级别: ${config.messageMonitor.logLevel}`,
        `• 欢迎功能: ${config.groupManagement.enableWelcome ? '启用' : '禁用'}`,
        `• 欢迎消息: ${config.groupManagement.welcomeMessage ? '已设置' : '未设置'}`,
        `• 拒绝消息: ${config.groupManagement.rejectionMessage ? '已设置' : '未设置'}`,
        `• 姓名验证失败消息: ${config.groupManagement.nameValidationMessage ? '已设置' : '未设置'}`,
        '',
        config.groupManagement.useNameValidation 
          ? '🔥 当前严格姓名验证模式已启用'
          : '💡 可启用严格姓名验证以实现更严格的入群管理',
        '',
        '📋 使用 help 命令查看完整功能列表'
      ].join('\n')
    })

  // 调试命令
  ctx.command('master.debug', '开启调试模式')
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

  logger.info('Group-Master 插件加载完成')
  logger.info('当前配置: ' + 
    '自动审批=' + config.groupManagement.autoApprove + ', ' +
    '严格姓名验证=' + config.groupManagement.useNameValidation + ', ' +
    'QQ号白名单=' + config.groupManagement.useWhitelist + ', ' +
    '关键词过滤=' + config.groupManagement.useKeywordFilter + ', ' +
    '数据库=' + config.database.enabled)
}