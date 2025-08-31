import { Context, Logger, h } from 'koishi'
import { Config as ConfigType } from './types'
import { ConfigSchema } from './config/schema'
import { KoishiDatabaseService, DatabaseService } from './database'
import { GroupRequestHandler } from './handlers/group-request'
import { RuleEngine } from './handlers/rule-engine'
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
  const rulesCommands = new RulesCommandHandler(ctx, config, database)

  // 注册命令
  rulesCommands.register()

  // 中间件：消息监控
  ctx.middleware(async (session, next) => {
    const { guildId, userId, content } = session

    // 消息监控
    if (config.messageMonitor.enabled && guildId) {
      const logData = {
        群组: guildId,
        用户: userId,
        内容: content?.slice(0, 100) + (content && content.length > 100 ? '...' : ''),
        时间: new Date().toISOString()
      }

      if (config.messageMonitor.logLevel === 'info') {
        logger.info('消息监控:', JSON.stringify(logData, null, 2))
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
        '🔧 通用规则管理:',
        '• rules - 查看规则管理帮助',
        '• rules.list - 查看规则列表',
        '• rules.create - 创建新规则',
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
        `💬 入群欢迎: ${config.groupManagement.enableWelcome ? '✅ 启用' : '❌ 禁用'}`,
        `📝 消息监控: ${config.messageMonitor.enabled ? '✅ 启用' : '❌ 禁用'}`,
        `💾 数据库存储: ${config.database.enabled ? '✅ 启用' : '❌ 禁用'}`,
        '',
        `💬 消息配置:`,
        `• 欢迎消息: ${config.groupManagement.welcomeMessage || '(未设置)'}`,
        `• 拒绝消息: ${config.groupManagement.rejectionMessage || '(未设置)'}`,
        '',
        '💡 使用通用规则系统来管理入群申请，通过 rules 命令查看和配置规则'
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
        `• 入群欢迎: ${config.groupManagement.enableWelcome ? '✅ 启用' : '❌ 禁用'}`,
        `• 自动审批: ${config.groupManagement.autoApprove ? '✅ 启用' : '❌ 禁用'}`,
        `• 数据库存储: ${database ? '✅ 已连接' : '❌ 未启用'}`,
        `• 通用规则引擎: ✅ 已加载`,
        '',
        '🔧 配置信息:',
        `• 日志级别: ${config.messageMonitor.logLevel}`,
        `• 欢迎功能: ${config.groupManagement.enableWelcome ? '启用' : '禁用'}`,
        `• 欢迎消息: ${config.groupManagement.welcomeMessage ? '已设置' : '未设置'}`,
        `• 拒绝消息: ${config.groupManagement.rejectionMessage ? '已设置' : '未设置'}`,
        '',
        '💡 使用 rules 命令查看和管理入群申请规则',
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
    '入群欢迎=' + config.groupManagement.enableWelcome + ', ' +
    '消息监控=' + config.messageMonitor.enabled + ', ' +
    '数据库=' + config.database.enabled)
}