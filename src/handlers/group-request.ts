import { Context, Logger } from 'koishi'
import { Config, GroupRequestSession, ApprovalResult } from '../types'
import { DatabaseService } from '../database'
import { RuleEngine } from './rule-engine'

const logger = new Logger('group-master:group-request')

export class GroupRequestHandler {
  constructor(
    private ctx: Context,
    private config: Config,
    private database: DatabaseService | undefined,
    private ruleEngine: RuleEngine
  ) {}

  async handleGroupRequest(session: GroupRequestSession) {
    const guildId = session.guildId || session.groupId || 'unknown'
    const userId = session.userId || session.user_id || 'unknown'
    const message = session.content || session.comment || ''

    logger.info(`收到入群申请: 群${guildId} 用户${userId} 消息: ${message}`)

    try {
      // 评估申请
      const result = await this.evaluateRequest(guildId, userId, message)
      
      if (result.shouldApprove) {
        await this.approveRequest(session, result.reason)
      } else {
        await this.rejectRequest(session, result.rejectionMessage || result.reason)
      }
    } catch (error: any) {
      logger.error('处理入群申请时发生错误:', error)
      await this.rejectRequest(session, '系统错误，请稍后重试')
    }
  }

  private async evaluateRequest(guildId: string, userId: string, message?: string): Promise<ApprovalResult> {
    const effectiveConfig = await this.getEffectiveConfig(guildId)

    // 使用规则引擎评估请求
    const ruleResult = await this.ruleEngine.evaluateRequest({
      guildId,
      userId,
      message,
      content: message
    })

    if (ruleResult) {
      return {
        shouldApprove: ruleResult.action === 'approve',
        reason: ruleResult.reason || `规则 ${ruleResult.ruleName} 执行: ${ruleResult.action}`,
        rejectionMessage: ruleResult.action === 'reject' ? ruleResult.message : undefined
      }
    }

    // 如果没有匹配的规则，根据配置决定默认行为
    return {
      shouldApprove: effectiveConfig.groupManagement.autoApprove,
      reason: effectiveConfig.groupManagement.autoApprove ? '无匹配规则，默认通过' : '无匹配规则，默认拒绝'
    }
  }

  private async getEffectiveConfig(guildId: string): Promise<Config> {
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

    return effectiveConfig
  }

  private async approveRequest(session: GroupRequestSession, reason: string) {
    try {
      if (session.approve) {
        await session.approve()
        logger.info(`✅ 入群申请已通过: ${reason}`)
      } else if (session.bot && session.flag) {
        await session.bot.setGroupAddRequest({
          flag: session.flag,
          approve: true,
          reason: ''
        })
        logger.info(`✅ 入群申请已通过: ${reason}`)
      } else {
        logger.warn('无法通过申请：缺少必要的方法')
      }
    } catch (error: any) {
      logger.error('通过申请时发生错误:', error)
    }
  }

  private async rejectRequest(session: GroupRequestSession, reason: string) {
    try {
      if (session.reject) {
        await session.reject(reason)
        logger.info(`❌ 入群申请已拒绝: ${reason}`)
      } else if (session.bot && session.flag) {
        await session.bot.setGroupAddRequest({
          flag: session.flag,
          approve: false,
          reason: reason
        })
        logger.info(`❌ 入群申请已拒绝: ${reason}`)
      } else {
        logger.warn('无法拒绝申请：缺少必要的方法')
      }
    } catch (error: any) {
      logger.error('拒绝申请时发生错误:', error)
    }
  }
}