import { Context, Logger } from 'koishi'
import { Config, Rule } from '../types'

const logger = new Logger('group-master:database')

export interface DatabaseService {
  // 初始化
  initTables?(): Promise<void>
  
  // 配置存储
  saveConfig(guildId: string, config: Partial<Config>): Promise<void>
  loadConfig(guildId: string): Promise<Partial<Config> | null>
  
  // 白名单管理
  addToWhitelist(guildId: string, userId: string): Promise<void>
  removeFromWhitelist(guildId: string, userId: string): Promise<void>
  getWhitelist(guildId: string): Promise<string[]>
  isInWhitelist(guildId: string, userId: string): Promise<boolean>
  
  // 姓名白名单管理
  addToNameWhitelist(guildId: string, name: string): Promise<void>
  removeFromNameWhitelist(guildId: string, name: string): Promise<void>
  getNameWhitelist(guildId: string): Promise<string[]>
  isNameInWhitelist(guildId: string, name: string): Promise<boolean>
  
  // 关键词管理
  addApprovalKeyword(guildId: string, keyword: string): Promise<void>
  removeApprovalKeyword(guildId: string, keyword: string): Promise<void>
  getApprovalKeywords(guildId: string): Promise<string[]>
  addRejectionKeyword(guildId: string, keyword: string): Promise<void>
  removeRejectionKeyword(guildId: string, keyword: string): Promise<void>
  getRejectionKeywords(guildId: string): Promise<string[]>
  
  // 规则管理
  saveRule(guildId: string, rule: Rule): Promise<void>
  deleteRule(guildId: string, ruleId: string): Promise<void>
  getRules(guildId: string): Promise<Rule[]>
  updateRule(guildId: string, ruleId: string, updates: Partial<Rule>): Promise<void>
}

declare module 'koishi' {
  interface Tables {
    group_master_config: GroupMasterConfig
    group_master_whitelist: GroupMasterWhitelist
    group_master_name_whitelist: GroupMasterNameWhitelist
    group_master_keywords: GroupMasterKeywords
    group_master_rules: GroupMasterRules
  }
}

export interface GroupMasterConfig {
  id: number
  guildId: string
  configKey: string
  configValue: string
  updatedAt: Date
}

export interface GroupMasterWhitelist {
  id: number
  guildId: string
  userId: string
  addedAt: Date
}

export interface GroupMasterNameWhitelist {
  id: number
  guildId: string
  name: string
  addedAt: Date
}

export interface GroupMasterKeywords {
  id: number
  guildId: string
  keyword: string
  type: 'approval' | 'rejection'
  addedAt: Date
}

export interface GroupMasterRules {
  id: number
  guildId: string
  ruleId: string
  ruleData: string // JSON字符串
  enabled: boolean
  priority: number
  updatedAt: Date
}

export class KoishiDatabaseService implements DatabaseService {
  constructor(private ctx: Context) {}

  async initTables(): Promise<void> {
    // 配置表
    this.ctx.model.extend('group_master_config', {
      id: 'unsigned',
      guildId: 'string(50)',
      configKey: 'string(100)',
      configValue: 'text',
      updatedAt: 'timestamp'
    }, {
      primary: 'id',
      unique: [['guildId', 'configKey']]
    })

    // QQ号白名单表
    this.ctx.model.extend('group_master_whitelist', {
      id: 'unsigned',
      guildId: 'string(50)',
      userId: 'string(20)',
      addedAt: 'timestamp'
    }, {
      primary: 'id',
      unique: [['guildId', 'userId']]
    })

    // 姓名白名单表
    this.ctx.model.extend('group_master_name_whitelist', {
      id: 'unsigned',
      guildId: 'string(50)',
      name: 'string(50)',
      addedAt: 'timestamp'
    }, {
      primary: 'id',
      unique: [['guildId', 'name']]
    })

    // 关键词表
    this.ctx.model.extend('group_master_keywords', {
      id: 'unsigned',
      guildId: 'string(50)',
      keyword: 'string(100)',
      type: 'string(20)',
      addedAt: 'timestamp'
    }, {
      primary: 'id',
      unique: [['guildId', 'keyword', 'type']]
    })

    // 规则表
    this.ctx.model.extend('group_master_rules', {
      id: 'unsigned',
      guildId: 'string(50)',
      ruleId: 'string(50)',
      ruleData: 'text',
      enabled: 'boolean',
      priority: 'integer',
      updatedAt: 'timestamp'
    }, {
      primary: 'id',
      unique: [['guildId', 'ruleId']]
    })
  }

  // 配置存储实现
  async saveConfig(guildId: string, config: Partial<Config>): Promise<void> {
    for (const [key, value] of Object.entries(config)) {
      await this.ctx.database.upsert('group_master_config', [{
        guildId,
        configKey: key,
        configValue: JSON.stringify(value),
        updatedAt: new Date()
      }], ['guildId', 'configKey'])
    }
    logger.info(`已保存群 ${guildId} 的配置`)
  }

  async loadConfig(guildId: string): Promise<Partial<Config> | null> {
    try {
      const records = await this.ctx.database.get('group_master_config', { guildId })
      if (records.length === 0) return null

      const config: any = {}
      for (const record of records) {
        try {
          config[record.configKey] = JSON.parse(record.configValue)
        } catch (e) {
          logger.warn(`解析配置失败: ${record.configKey}`, e)
        }
      }
      return config
    } catch (error) {
      logger.error('加载配置失败', error)
      return null
    }
  }

  // QQ号白名单实现
  async addToWhitelist(guildId: string, userId: string): Promise<void> {
    try {
      await this.ctx.database.create('group_master_whitelist', {
        guildId,
        userId,
        addedAt: new Date()
      })
    } catch (error) {
      // 忽略重复添加的错误
      if (!error.message?.includes('duplicate')) {
        throw error
      }
    }
  }

  async removeFromWhitelist(guildId: string, userId: string): Promise<void> {
    await this.ctx.database.remove('group_master_whitelist', { guildId, userId })
  }

  async getWhitelist(guildId: string): Promise<string[]> {
    const records = await this.ctx.database.get('group_master_whitelist', { guildId })
    return records.map(r => r.userId)
  }

  async isInWhitelist(guildId: string, userId: string): Promise<boolean> {
    const records = await this.ctx.database.get('group_master_whitelist', { guildId, userId })
    return records.length > 0
  }

  // 姓名白名单实现
  async addToNameWhitelist(guildId: string, name: string): Promise<void> {
    try {
      await this.ctx.database.create('group_master_name_whitelist', {
        guildId,
        name: name.trim(),
        addedAt: new Date()
      })
    } catch (error) {
      if (!error.message?.includes('duplicate')) {
        throw error
      }
    }
  }

  async removeFromNameWhitelist(guildId: string, name: string): Promise<void> {
    await this.ctx.database.remove('group_master_name_whitelist', { guildId, name: name.trim() })
  }

  async getNameWhitelist(guildId: string): Promise<string[]> {
    const records = await this.ctx.database.get('group_master_name_whitelist', { guildId })
    return records.map(r => r.name)
  }

  async isNameInWhitelist(guildId: string, name: string): Promise<boolean> {
    const records = await this.ctx.database.get('group_master_name_whitelist', { guildId, name: name.trim() })
    return records.length > 0
  }

  // 关键词管理实现
  async addApprovalKeyword(guildId: string, keyword: string): Promise<void> {
    try {
      await this.ctx.database.create('group_master_keywords', {
        guildId,
        keyword: keyword.trim(),
        type: 'approval',
        addedAt: new Date()
      })
    } catch (error) {
      if (!error.message?.includes('duplicate')) {
        throw error
      }
    }
  }

  async removeApprovalKeyword(guildId: string, keyword: string): Promise<void> {
    await this.ctx.database.remove('group_master_keywords', { 
      guildId, 
      keyword: keyword.trim(), 
      type: 'approval' 
    })
  }

  async getApprovalKeywords(guildId: string): Promise<string[]> {
    const records = await this.ctx.database.get('group_master_keywords', { 
      guildId, 
      type: 'approval' 
    })
    return records.map(r => r.keyword)
  }

  async addRejectionKeyword(guildId: string, keyword: string): Promise<void> {
    try {
      await this.ctx.database.create('group_master_keywords', {
        guildId,
        keyword: keyword.trim(),
        type: 'rejection',
        addedAt: new Date()
      })
    } catch (error) {
      if (!error.message?.includes('duplicate')) {
        throw error
      }
    }
  }

  async removeRejectionKeyword(guildId: string, keyword: string): Promise<void> {
    await this.ctx.database.remove('group_master_keywords', { 
      guildId, 
      keyword: keyword.trim(), 
      type: 'rejection' 
    })
  }

  async getRejectionKeywords(guildId: string): Promise<string[]> {
    const records = await this.ctx.database.get('group_master_keywords', { 
      guildId, 
      type: 'rejection' 
    })
    return records.map(r => r.keyword)
  }

  // 规则管理实现
  async saveRule(guildId: string, rule: Rule): Promise<void> {
    await this.ctx.database.upsert('group_master_rules', [{
      guildId,
      ruleId: rule.id,
      ruleData: JSON.stringify(rule),
      enabled: rule.enabled,
      priority: rule.priority,
      updatedAt: new Date()
    }], ['guildId', 'ruleId'])
  }

  async deleteRule(guildId: string, ruleId: string): Promise<void> {
    await this.ctx.database.remove('group_master_rules', { guildId, ruleId })
  }

  async getRules(guildId: string): Promise<Rule[]> {
    const records = await this.ctx.database.get('group_master_rules', { guildId })
    // 手动排序
    records.sort((a, b) => a.priority - b.priority)
    
    return records.map(r => {
      try {
        return JSON.parse(r.ruleData)
      } catch (e) {
        logger.warn(`解析规则失败: ${r.ruleId}`, e)
        return null
      }
    }).filter(Boolean)
  }

  async updateRule(guildId: string, ruleId: string, updates: Partial<Rule>): Promise<void> {
    const rules = await this.ctx.database.get('group_master_rules', { guildId, ruleId })
    if (rules.length === 0) {
      throw new Error('规则不存在')
    }
    
    const existingRule = JSON.parse(rules[0].ruleData)
    const updatedRule = { ...existingRule, ...updates }
    
    await this.ctx.database.upsert('group_master_rules', [{
      guildId,
      ruleId,
      ruleData: JSON.stringify(updatedRule),
      enabled: updatedRule.enabled,
      priority: updatedRule.priority,
      updatedAt: new Date()
    }], ['guildId', 'ruleId'])
  }
}