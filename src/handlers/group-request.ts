import { Context, Logger } from 'koishi'
import { Config, GroupRequestSession, ApprovalResult } from '../types'
import { DatabaseService } from '../database'
import { RuleEngine } from './rule-engine'

const logger = new Logger('group-master:request-handler')

export class GroupRequestHandler {
  constructor(
    private ctx: Context,
    private config: Config,
    private database?: DatabaseService,
    private ruleEngine?: RuleEngine
  ) {}

  async handleGroupRequest(session: GroupRequestSession): Promise<void> {
    const guildId = session.guildId || session.groupId
    const userId = session.userId || session.user_id
    const messageId = session.messageId || session.flag
    
    logger.info(`收到入群申请: 用户 ${userId} 申请加入群 ${guildId}`)
    logger.info(`申请消息: ${session.content || session.comment || '无'}`)
    
    if (!this.config.groupManagement.autoApprove) {
      logger.info('自动审批功能已禁用')
      return
    }

    if (!guildId || !userId) {
      logger.warn('缺少必要的群组或用户信息')
      return
    }

    try {
      let result: ApprovalResult
      
      // 优先使用规则引擎
      if (this.ruleEngine && this.config.database.enabled) {
        result = await this.ruleEngine.evaluateRequest(guildId, userId, session.content || session.comment || '', session)
      } else {
        // 降级使用传统逻辑
        result = await this.evaluateRequest(guildId, userId, session.content || session.comment || '')
      }
      
      if (result.shouldApprove) {
        await this.approveRequest(session, messageId, result.reason, guildId)
      } else {
        await this.rejectRequest(session, messageId, result.reason, result.rejectionMessage || this.config.groupManagement.rejectionMessage, userId)
      }
    } catch (error) {
      logger.error(`处理入群申请失败: ${error}`)
    }
  }

  private async evaluateRequest(guildId: string, userId: string, message: string): Promise<ApprovalResult> {
    // 如果启用数据库，优先从数据库加载配置
    let effectiveConfig = this.config
    if (this.database && this.config.database.enabled) {
      try {
        const dbConfig = await this.database.loadConfig(guildId)
        if (dbConfig) {
          effectiveConfig = { ...this.config, ...dbConfig } as Config
        }
      } catch (error) {
        logger.warn('从数据库加载配置失败，使用默认配置', error)
      }
    }

    // 优先级1: 严格姓名验证模式
    if (effectiveConfig.groupManagement.useNameValidation) {
      return await this.evaluateNameValidation(guildId, message, effectiveConfig)
    }

    // 优先级2: QQ号白名单检查
    if (effectiveConfig.groupManagement.useWhitelist) {
      const whitelistResult = await this.evaluateWhitelist(guildId, userId, effectiveConfig)
      if (whitelistResult.shouldApprove || effectiveConfig.groupManagement.autoRejectNonWhitelist) {
        return whitelistResult
      }
    }

    // 优先级3: 关键词过滤
    if (effectiveConfig.groupManagement.useKeywordFilter && message) {
      return this.evaluateKeywords(message, effectiveConfig)
    }

    // 默认行为
    if (!effectiveConfig.groupManagement.useWhitelist && !effectiveConfig.groupManagement.useKeywordFilter) {
      return {
        shouldApprove: true,
        reason: '无过滤规则，默认通过'
      }
    }

    return {
      shouldApprove: false,
      reason: '未匹配任何通过条件'
    }
  }

  private async evaluateNameValidation(guildId: string, message: string, config: Config): Promise<ApprovalResult> {
    let nameWhitelist: string[]
    
    if (this.database && config.database.enabled) {
      try {
        nameWhitelist = await this.database.getNameWhitelist(guildId)
      } catch (error) {
        logger.warn('从数据库获取姓名白名单失败，使用配置文件', error)
        nameWhitelist = config.nameWhitelist
      }
    } else {
      nameWhitelist = config.nameWhitelist
    }

    const hasMatchingName = nameWhitelist.some(name => 
      message.includes(name.trim()) && name.trim().length > 0
    )

    if (hasMatchingName) {
      return {
        shouldApprove: true,
        reason: '姓名验证通过'
      }
    }

    return {
      shouldApprove: false,
      reason: '姓名验证失败',
      rejectionMessage: config.groupManagement.nameValidationMessage
    }
  }

  private async evaluateWhitelist(guildId: string, userId: string, config: Config): Promise<ApprovalResult> {
    let isInWhitelist: boolean
    
    if (this.database && config.database.enabled) {
      try {
        isInWhitelist = await this.database.isInWhitelist(guildId, userId)
      } catch (error) {
        logger.warn('从数据库检查白名单失败，使用配置文件', error)
        isInWhitelist = config.whitelist.includes(userId)
      }
    } else {
      isInWhitelist = config.whitelist.includes(userId)
    }

    if (isInWhitelist) {
      return {
        shouldApprove: true,
        reason: '白名单用户'
      }
    }

    if (config.groupManagement.autoRejectNonWhitelist) {
      return {
        shouldApprove: false,
        reason: '不在白名单中'
      }
    }

    return {
      shouldApprove: false,
      reason: '需要进一步检查'
    }
  }

  private evaluateKeywords(message: string, config: Config): ApprovalResult {
    if (config.rejectionKeywords.some(keyword => message.includes(keyword))) {
      return {
        shouldApprove: false,
        reason: '包含拒绝关键词'
      }
    }

    if (config.approvalKeywords.some(keyword => message.includes(keyword))) {
      return {
        shouldApprove: true,
        reason: '包含通过关键词'
      }
    }

    return {
      shouldApprove: false,
      reason: '关键词检查未通过'
    }
  }

  private async approveRequest(session: GroupRequestSession, messageId: string | undefined, reason: string, guildId: string): Promise<void> {
    try {
      if (session.approve) {
        await session.approve()
      } else if (session.bot?.handleGuildRequest) {
        await session.bot.handleGuildRequest(messageId, true)
      } else if (session.bot?.setGroupAddRequest) {
        await session.bot.setGroupAddRequest(messageId, true)
      }
      
      logger.info(`自动通过入群申请: 用户 ${session.userId || session.user_id} (${reason})`)
      
      // 发送欢迎消息
      if (this.config.groupManagement.enableWelcome && this.config.groupManagement.welcomeMessage) {
        setTimeout(async () => {
          try {
            await session.bot?.sendMessage(guildId, this.config.groupManagement.welcomeMessage)
          } catch (error) {
            logger.error('发送欢迎消息失败:', error)
          }
        }, 2000)
      }
    } catch (error) {
      logger.error('通过申请时出错:', error)
    }
  }

  private async rejectRequest(session: GroupRequestSession, messageId: string | undefined, reason: string, rejectionMessage: string, userId: string): Promise<void> {
    try {
      if (session.reject) {
        await session.reject(rejectionMessage)
      } else if (session.bot?.handleGuildRequest) {
        await session.bot.handleGuildRequest(messageId, false, rejectionMessage)
      } else if (session.bot?.setGroupAddRequest) {
        await session.bot.setGroupAddRequest(messageId, false, rejectionMessage)
      }
      
      logger.info(`自动拒绝入群申请: 用户 ${userId} (${reason})`)
      logger.info(`拒绝消息: ${rejectionMessage}`)
    } catch (error) {
      logger.error('拒绝申请时出错:', error)
    }
  }
}