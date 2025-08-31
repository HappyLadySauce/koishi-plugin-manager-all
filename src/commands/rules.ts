import { Logger } from 'koishi'
import { BaseCommandHandler } from './base'
import { Rule, RuleCondition } from '../types'

const logger = new Logger('group-master:rules-commands')

export class RulesCommandHandler extends BaseCommandHandler {
  register() {
    // 规则管理主命令
    this.ctx.command('rules', '通用规则管理')
      .action(async ({ session }) => {
        const guildId = session?.guildId
        const helpMessage = [
          '🔧 通用规则管理命令:',
          '',
          '📋 基础操作:',
          '• rules.list - 查看规则列表',
          '• rules.create - 创建新规则（交互式）',
          '• rules.delete <规则ID> - 删除规则',
          '• rules.toggle <规则ID> - 启用/禁用规则',
          '',
          '⚙️ 规则配置:',
          '• rules.priority <规则ID> <优先级> - 设置优先级',
          '• rules.test <规则ID> <测试消息> - 测试规则',
          '',
          '📊 预设规则:',
          '• rules.preset.whitelist - 创建QQ号白名单规则',
          '• rules.preset.names - 创建姓名验证规则',
          '• rules.preset.keywords - 创建关键词过滤规则',
          '',
          '💡 规则类型:',
          '• userId - QQ号条件',
          '• name - 姓名条件', 
          '• keyword - 关键词条件',
          '• database - 数据库查询条件',
          '• custom - 自定义JavaScript表达式',
          '',
          `当前规则数量: ${await this.getRuleCount(guildId)} 个`,
          `数据库存储: ${this.config.database.enabled ? '✅ 启用' : '❌ 禁用'}`
        ].join('\n')
        
        return helpMessage
      })

    this.ctx.command('rules.list', '查看规则列表')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        const rules = await this.getRules(guildId)
        
        if (rules.length === 0) {
          return '📋 暂无自定义规则'
        }

        const rulesList = rules
          .sort((a, b) => a.priority - b.priority)
          .map((rule, index) => {
            const status = rule.enabled ? '✅' : '❌'
            const action = rule.action === 'approve' ? '✅ 通过' : '❌ 拒绝'
            return [
              `${index + 1}. ${status} ${rule.name}`,
              `   ID: ${rule.id}`,
              `   优先级: ${rule.priority}`,
              `   动作: ${action}`,
              `   条件: ${this.formatCondition(rule.condition)}`,
              rule.description ? `   描述: ${rule.description}` : '',
              ''
            ].filter(line => line !== '').join('\n')
          })
          .join('\n')

        return `📋 规则列表 (${rules.length} 个):\n\n${rulesList}`
      })

    this.ctx.command('rules.delete <ruleId:string>', '删除规则')
      .action(async ({ session }, ruleId) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!ruleId) {
          return '❌ 请提供规则ID'
        }

        const rules = await this.getRules(guildId)
        const rule = rules.find(r => r.id === ruleId)
        
        if (!rule) {
          return '❌ 规则不存在'
        }

        await this.deleteRule(guildId, ruleId)
        return `✅ 已删除规则: ${rule.name} (${ruleId})`
      })

    this.ctx.command('rules.toggle <ruleId:string>', '启用/禁用规则')
      .action(async ({ session }, ruleId) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!ruleId) {
          return '❌ 请提供规则ID'
        }

        const rules = await this.getRules(guildId)
        const rule = rules.find(r => r.id === ruleId)
        
        if (!rule) {
          return '❌ 规则不存在'
        }

        const newEnabled = !rule.enabled
        await this.updateRule(guildId, ruleId, { enabled: newEnabled })
        
        return `${newEnabled ? '✅ 已启用' : '❌ 已禁用'} 规则: ${rule.name}`
      })

    this.ctx.command('rules.priority <ruleId:string> <priority:number>', '设置规则优先级')
      .action(async ({ session }, ruleId, priority) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!ruleId) {
          return '❌ 请提供规则ID'
        }

        if (priority < 0 || priority > 1000) {
          return '❌ 优先级必须在0-1000之间'
        }

        const rules = await this.getRules(guildId)
        const rule = rules.find(r => r.id === ruleId)
        
        if (!rule) {
          return '❌ 规则不存在'
        }

        await this.updateRule(guildId, ruleId, { priority })
        
        return `✅ 已设置规则 "${rule.name}" 的优先级为 ${priority}`
      })

    // 预设规则创建
    this.ctx.command('rules.preset.whitelist', '创建QQ号白名单规则')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        const rule: Rule = {
          id: `whitelist_${Date.now()}`,
          name: 'QQ号白名单验证',
          priority: 10,
          enabled: true,
          condition: {
            type: 'userId',
            value: null, // 将使用数据库中的白名单
            operator: 'in'
          },
          action: 'approve',
          description: '检查用户QQ号是否在白名单中'
        }

        await this.saveRule(guildId, rule)
        return `✅ 已创建QQ号白名单规则: ${rule.id}`
      })

    this.ctx.command('rules.preset.names', '创建姓名验证规则')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        const rule: Rule = {
          id: `names_${Date.now()}`,
          name: '姓名白名单验证',
          priority: 5,
          enabled: true,
          condition: {
            type: 'name',
            value: null, // 将使用数据库中的姓名白名单
            operator: 'in'
          },
          action: 'approve',
          message: this.config.groupManagement.nameValidationMessage,
          description: '检查申请消息中是否包含白名单中的姓名'
        }

        await this.saveRule(guildId, rule)
        return `✅ 已创建姓名验证规则: ${rule.id}`
      })

    this.ctx.command('rules.preset.keywords <keywords:text>', '创建关键词过滤规则')
      .example('rules.preset.keywords 广告,营销,推广')
      .action(async ({ session }, keywords) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!keywords) {
          return [
            '❌ 请提供关键词列表',
            '',
            '💡 示例: rules.preset.keywords 广告,营销,推广'
          ].join('\n')
        }

        const keywordList = keywords.split(/[,\s]+/).filter(k => k.trim().length > 0)
        
        const rule: Rule = {
          id: `keywords_${Date.now()}`,
          name: '关键词过滤',
          priority: 20,
          enabled: true,
          condition: {
            type: 'keyword',
            value: keywordList,
            operator: 'in'
          },
          action: 'reject',
          description: `拒绝包含以下关键词的申请: ${keywordList.join(', ')}`
        }

        await this.saveRule(guildId, rule)
        return `✅ 已创建关键词过滤规则: ${rule.id}\n拦截关键词: ${keywordList.join(', ')}`
      })

    this.ctx.command('rules.test <ruleId:string> <message:text>', '测试规则')
      .action(async ({ session }, ruleId, message) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!ruleId || !message) {
          return '❌ 请提供规则ID和测试消息'
        }

        const rules = await this.getRules(guildId)
        const rule = rules.find(r => r.id === ruleId)
        
        if (!rule) {
          return '❌ 规则不存在'
        }

        // 这里应该调用规则引擎进行测试
        // 简化版本的测试逻辑
        const result = await this.testRule(rule, {
          guildId,
          userId: session?.userId || 'test_user',
          message
        })

        return [
          `🧪 规则测试结果:`,
          ``,
          `📝 规则: ${rule.name}`,
          `📨 测试消息: "${message}"`,
          `✨ 匹配结果: ${result ? '✅ 匹配' : '❌ 不匹配'}`,
          `🎯 预期动作: ${rule.action === 'approve' ? '✅ 通过申请' : '❌ 拒绝申请'}`
        ].join('\n')
      })
  }

  private formatCondition(condition: RuleCondition): string {
    const typeNames = {
      userId: 'QQ号',
      name: '姓名',
      keyword: '关键词',
      database: '数据库',
      custom: '自定义'
    }
    
    const operatorNames = {
      equals: '等于',
      contains: '包含',
      matches: '匹配',
      in: '在列表中',
      not_in: '不在列表中'
    }

    const typeName = typeNames[condition.type] || condition.type
    const operatorName = operatorNames[condition.operator || 'equals'] || condition.operator

    if (Array.isArray(condition.value)) {
      return `${typeName} ${operatorName} [${condition.value.slice(0, 3).join(', ')}${condition.value.length > 3 ? '...' : ''}]`
    } else if (condition.value === null || condition.value === undefined) {
      return `${typeName} ${operatorName} 数据库数据`
    } else {
      return `${typeName} ${operatorName} "${String(condition.value).slice(0, 20)}"`
    }
  }

  private async getRules(guildId: string): Promise<Rule[]> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.getRules(guildId)
      } catch (error) {
        logger.warn('从数据库获取规则失败', error)
      }
    }
    return []
  }

  private async getRuleCount(guildId?: string): Promise<number> {
    if (guildId) {
      const rules = await this.getRules(guildId)
      return rules.length
    }
    return 0
  }

  private async saveRule(guildId: string, rule: Rule): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.saveRule(guildId, rule)
        return
      } catch (error) {
        logger.error('保存规则到数据库失败', error)
        throw new Error('保存规则失败')
      }
    }
    throw new Error('数据库未启用，无法保存规则')
  }

  private async deleteRule(guildId: string, ruleId: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.deleteRule(guildId, ruleId)
        return
      } catch (error) {
        logger.error('删除规则失败', error)
        throw new Error('删除规则失败')
      }
    }
    throw new Error('数据库未启用，无法删除规则')
  }

  private async updateRule(guildId: string, ruleId: string, updates: Partial<Rule>): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.updateRule(guildId, ruleId, updates)
        return
      } catch (error) {
        logger.error('更新规则失败', error)
        throw new Error('更新规则失败')
      }
    }
    throw new Error('数据库未启用，无法更新规则')
  }

  private async testRule(rule: Rule, context: { guildId: string, userId: string, message: string }): Promise<boolean> {
    // 简化的规则测试逻辑
    const { condition } = rule
    const { message, userId } = context

    switch (condition.type) {
      case 'keyword':
        if (Array.isArray(condition.value)) {
          return condition.value.some(keyword => message.includes(keyword))
        }
        return message.includes(String(condition.value))
      
      case 'name':
        if (condition.operator === 'contains') {
          return message.includes(String(condition.value))
        }
        return false
      
      case 'userId':
        if (condition.operator === 'equals') {
          return userId === String(condition.value)
        }
        return false
      
      default:
        return false
    }
  }
}