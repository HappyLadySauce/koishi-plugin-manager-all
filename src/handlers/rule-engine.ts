import { Logger } from 'koishi'
import { Config, Rule, RuleCondition } from '../types'
import { DatabaseService } from '../database'

const logger = new Logger('group-master:rule-engine')

interface RequestContext {
  guildId: string
  userId: string
  message?: string
  content?: string
}

interface RuleResult {
  action: 'approve' | 'reject' | 'ignore'
  reason?: string
  message?: string
  ruleName?: string
}

export class RuleEngine {
  constructor(
    private config: Config,
    private database?: DatabaseService
  ) {}

  async evaluateRequest(context: RequestContext): Promise<RuleResult | null> {
    // 获取当前群组的规则
    const rules = await this.getRules(context.guildId)
    
    // 按优先级排序（数字越小优先级越高）
    rules.sort((a, b) => a.priority - b.priority)

    for (const rule of rules) {
      if (!rule.enabled) continue

      try {
        const matches = await this.evaluateCondition(rule.condition, context)
        
        if (matches) {
          logger.info(`规则匹配: ${rule.name} (${rule.id}), 动作: ${rule.action}`)
          
          return {
            action: rule.action,
            reason: `匹配规则: ${rule.name}`,
            message: rule.message,
            ruleName: rule.name
          }
        }
      } catch (error: any) {
        logger.warn(`规则执行失败: ${rule.name}`, error)
        continue
      }
    }

    // 没有匹配的规则
    return null
  }

  private async evaluateCondition(condition: RuleCondition, context: RequestContext): Promise<boolean> {
    const { type, value, operator = 'equals' } = condition
    const { guildId, userId, content } = context

    switch (type) {
      case 'userId':
        return this.evaluateUserIdCondition(userId, value, operator)
      
      case 'keyword':
        return this.evaluateKeywordCondition(content || '', value, operator)
      
      case 'custom':
        return this.evaluateCustomCondition(value, context)
      
      case 'database':
        return this.evaluateDatabaseCondition(value, context)
      
      default:
        logger.warn(`未知的条件类型: ${type}`)
        return false
    }
  }

  private evaluateUserIdCondition(userId: string, value: any, operator: string): boolean {
    switch (operator) {
      case 'equals':
        return userId === String(value)
      
      case 'in':
        return Array.isArray(value) ? value.includes(userId) : false
      
      case 'not_in':
        return Array.isArray(value) ? !value.includes(userId) : true
      
      default:
        return false
    }
  }

  private evaluateKeywordCondition(content: string, value: any, operator: string): boolean {
    const keywords = Array.isArray(value) ? value : [value]
    
    switch (operator) {
      case 'contains':
        return keywords.some(keyword => content.includes(String(keyword)))
      
      case 'equals':
        return keywords.includes(content)
      
      case 'matches':
        return keywords.some(pattern => {
          try {
            const regex = new RegExp(String(pattern), 'i')
            return regex.test(content)
          } catch (e) {
            return false
          }
        })
      
      default:
        return false
    }
  }

  private evaluateCustomCondition(expression: string, context: RequestContext): boolean {
    try {
      // 创建安全的执行环境
      const safeContext = {
        userId: context.userId,
        guildId: context.guildId,
        content: context.content || '',
        message: context.message || ''
      }
      
      // 简单的表达式求值（只支持基本比较）
      const func = new Function('context', `
        const { userId, guildId, content, message } = context;
        return ${expression};
      `)
      
      return Boolean(func(safeContext))
    } catch (error: any) {
      logger.warn('自定义表达式执行失败:', error.message)
      return false
    }
  }

  private async evaluateDatabaseCondition(query: any, context: RequestContext): Promise<boolean> {
    if (!this.database) return false
    
    try {
      // 这里可以扩展数据库查询逻辑
      // 目前只是简单的占位符实现
      logger.info(`数据库条件查询: ${JSON.stringify(query)}`)
      return false
    } catch (error: any) {
      logger.warn('数据库条件执行失败:', error)
      return false
    }
  }

  private async getRules(guildId: string): Promise<Rule[]> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.getRules(guildId)
      } catch (error: any) {
        logger.warn('从数据库获取规则失败:', error)
      }
    }
    
    // 返回空数组，所有规则通过命令动态创建
    return []
  }

  async createPresetRule(guildId: string, type: 'keywords', data: any): Promise<Rule> {
    const ruleId = `preset_${type}_${Date.now()}`
    
    let rule: Rule
    
    switch (type) {
      case 'keywords':
        const keywords = Array.isArray(data) ? data : [data]
        rule = {
          id: ruleId,
          name: `关键词规则: ${keywords.join(', ')}`,
          priority: 10,
          enabled: true,
          condition: {
            type: 'keyword',
            value: keywords,
            operator: 'contains'
          },
          action: 'reject',
          message: '申请被拒绝：包含禁止关键词',
          description: '自动检测并拒绝包含特定关键词的申请'
        }
        break
      
      default:
        throw new Error(`不支持的预设规则类型: ${type}`)
    }

    // 保存到数据库
    if (this.database && this.config.database.enabled) {
      await this.database.saveRule(guildId, rule)
    }
    
    return rule
  }
}