import { Context, Logger } from 'koishi'
import { Config, Rule, RuleCondition } from '../types'
import { DatabaseService } from '../database'

const logger = new Logger('group-master:rules-commands')

export class RulesCommandHandler {
  constructor(
    private ctx: Context,
    private config: Config,
    private database: DatabaseService | undefined
  ) {}

  private async ensureGuildContext(guildId?: string): Promise<string> {
    if (!guildId) {
      throw new Error('此命令只能在群组中使用')
    }
    return guildId
  }

  private async saveRule(guildId: string, rule: Rule): Promise<void> {
    if (this.database && this.config.database.enabled) {
      await this.database.saveRule(guildId, rule)
    } else {
      throw new Error('数据库未启用，无法保存规则')
    }
  }

  private async getRules(guildId: string): Promise<Rule[]> {
    if (this.database && this.config.database.enabled) {
      return await this.database.getRules(guildId)
    }
    return []
  }

  private async updateRule(guildId: string, ruleId: string, updates: Partial<Rule>): Promise<void> {
    if (this.database && this.config.database.enabled) {
      await this.database.updateRule(guildId, ruleId, updates)
    } else {
      throw new Error('数据库未启用，无法更新规则')
    }
  }

  private async deleteRule(guildId: string, ruleId: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      await this.database.deleteRule(guildId, ruleId)
    } else {
      throw new Error('数据库未启用，无法删除规则')
    }
  }

  register() {
    // 规则管理主命令
    this.ctx.command('rules', '通用规则管理')
      .action(async ({ session }) => {
        const helpMessage = [
          '🔧 通用规则管理命令:',
          '',
          '• rules.list - 查看规则列表',
          '• rules.create - 创建新规则',
          '• rules.delete <规则ID> - 删除规则',
          '• rules.toggle <规则ID> - 启用/禁用规则',
          '• rules.priority <规则ID> <优先级> - 设置规则优先级',
          '• rules.test <规则ID> <测试消息> - 测试规则',
          '',
          '🎯 预设规则模板:',
          '• rules.preset.keywords <关键词> - 创建关键词过滤规则',
          '',
          '💡 规则按优先级顺序执行，数字越小优先级越高'
        ].join('\n')
        
        return helpMessage
      })

    // 查看规则列表
    this.ctx.command('rules.list', '查看规则列表')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        const rules = await this.getRules(guildId)
        
        if (rules.length === 0) {
          return '📋 当前没有任何规则\n\n💡 使用 rules.preset.keywords 命令创建第一个规则'
        }

        const rulesList = rules.map(rule => {
          const status = rule.enabled ? '✅' : '❌'
          const action = rule.action === 'approve' ? '通过' : '拒绝'
          return `${status} [${rule.priority}] ${rule.name} (${rule.id}) - ${action}`
        }).join('\n')

        return `📋 规则列表 (${rules.length} 个):\n\n${rulesList}`
      })

    // 删除规则
    this.ctx.command('rules.delete <ruleId:text>', '删除规则')
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
        return `✅ 已删除规则: ${rule.name}`
      })

    // 切换规则状态
    this.ctx.command('rules.toggle <ruleId:text>', '启用/禁用规则')
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

        await this.updateRule(guildId, ruleId, { enabled: !rule.enabled })
        
        const status = !rule.enabled ? '启用' : '禁用'
        return `✅ 已${status}规则: ${rule.name}`
      })

    // 设置规则优先级
    this.ctx.command('rules.priority <ruleId:text> <priority:number>', '设置规则优先级')
      .action(async ({ session }, ruleId, priority) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!ruleId || priority === undefined) {
          return '❌ 请提供规则ID和优先级数字'
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
    this.ctx.command('rules.preset.keywords <keywords:text>', '创建关键词过滤规则')
      .example('rules.preset.keywords 广告,营销,推广')
      .action(async ({ session }, keywords) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!keywords) {
          return '❌ 请提供关键词，多个关键词用逗号分隔'
        }

        const keywordList = keywords.split(/[,，\s]+/).filter(k => k.trim())
        
        if (keywordList.length === 0) {
          return '❌ 未找到有效的关键词'
        }

        const rule: Rule = {
          id: `keywords_${Date.now()}`,
          name: `关键词过滤: ${keywordList.join(', ')}`,
          priority: 20,
          enabled: true,
          condition: {
            type: 'keyword',
            value: keywordList,
            operator: 'contains'
          },
          action: 'reject',
          message: '申请被拒绝：包含禁止关键词',
          description: `自动拒绝包含以下关键词的申请: ${keywordList.join(', ')}`
        }

        await this.saveRule(guildId, rule)
        return `✅ 已创建关键词过滤规则: ${rule.id}\n📝 将自动拒绝包含这些关键词的申请: ${keywordList.join(', ')}`
      })

    // 测试规则
    this.ctx.command('rules.test <ruleId:text> <message:text>', '测试规则')
      .example('rules.test keywords_123456 这是一个测试消息')
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

        // 简单的规则测试逻辑
        let matches = false
        
        try {
          if (rule.condition.type === 'keyword') {
            const keywords = Array.isArray(rule.condition.value) ? rule.condition.value : [rule.condition.value]
            
            switch (rule.condition.operator) {
              case 'contains':
                matches = keywords.some(keyword => message.includes(String(keyword)))
                break
              case 'equals':
                matches = keywords.includes(message)
                break
              case 'matches':
                matches = keywords.some(pattern => {
                  try {
                    const regex = new RegExp(String(pattern), 'i')
                    return regex.test(message)
                  } catch (e) {
                    return false
                  }
                })
                break
            }
          }
        } catch (error: any) {
          return `❌ 测试规则时发生错误: ${error.message}`
        }

        const result = matches ? '✅ 匹配' : '❌ 不匹配'
        const action = matches ? rule.action : '无动作'
        const actionText = action === 'approve' ? '通过' : action === 'reject' ? '拒绝' : '忽略'
        
        return [
          `🧪 规则测试结果:`,
          `• 规则: ${rule.name}`,
          `• 测试消息: ${message}`,
          `• 匹配结果: ${result}`,
          `• 执行动作: ${actionText}`,
          matches && rule.message ? `• 消息: ${rule.message}` : ''
        ].filter(Boolean).join('\n')
      })
  }
}