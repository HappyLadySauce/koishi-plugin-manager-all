import { Logger } from 'koishi'
import { BaseCommandHandler } from './base'
import { cleanName, validateNames, formatValidationReport } from '../utils/validation'

const logger = new Logger('group-master:names-commands')

export class NamesCommandHandler extends BaseCommandHandler {
  register() {
    // 姓名白名单管理命令
    this.ctx.command('names', '姓名白名单管理')
      .action(async ({ session }) => {
        const guildId = session?.guildId
        const helpMessage = [
          '👤 姓名白名单管理命令:',
          '',
          '➕ 添加操作:',
          '• names.add <姓名> - 添加单个姓名',
          '• names.batch <姓名列表> - 批量添加姓名',
          '• names.quick <姓名> - 快速添加（自动去重）',
          '',
          '➖ 移除操作:',
          '• names.remove <姓名> - 移除姓名',
          '• names.clear - 清空姓名白名单',
          '',
          '📄 查看操作:',
          '• names.list - 查看姓名白名单列表',
          '',
          '⚙️ 配置操作:',
          '• names.validation-toggle - 切换严格姓名验证模式',
          '',
          '📊 批量添加示例:',
          '• names.batch 张三,李四,王五',
          '• names.batch 张三 李四 王五',
          '',
          `当前严格验证状态: ${this.formatBooleanStatus(this.config.groupManagement.useNameValidation)}`,
          `姓名白名单数量: ${await this.getNameWhitelistCount(guildId)} 个`,
          '',
          '💡 启用严格验证时，只有填写了白名单中姓名的申请才会通过'
        ].join('\n')
        
        return helpMessage
      })

    this.ctx.command('names.add <name:string>', '添加姓名到白名单')
      .action(async ({ session }, name) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!name || name.trim().length === 0) {
          return '❌ 请提供有效的姓名'
        }

        const trimmedName = name.trim()
        if (await this.isNameInWhitelist(guildId, trimmedName)) {
          return '⚠️ 该姓名已在白名单中'
        }

        await this.addToNameWhitelist(guildId, trimmedName)
        return `✅ 已将 "${trimmedName}" 添加到姓名白名单`
      })

    this.ctx.command('names.quick <name:string>', '快速添加姓名到白名单（智能处理）')
      .action(async ({ session }, name) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!name) {
          return '❌ 请提供姓名'
        }

        const cleanedName = cleanName(name)
        
        if (!cleanedName) {
          return [
            '❌ 无效的姓名格式',
            '',
            '💡 支持的格式:',
            '• 中文姓名: 张三、李四',
            '• 英文姓名: John Smith',
            '• 混合姓名: 会自动清理特殊字符',
            '• 姓名长度: 2-10个字符'
          ].join('\n')
        }

        if (await this.isNameInWhitelist(guildId, cleanedName)) {
          return `⚠️ 姓名 "${cleanedName}" 已在白名单中`
        }

        await this.addToNameWhitelist(guildId, cleanedName)
        return `✅ 已将姓名 "${cleanedName}" 添加到白名单`
      })

    this.ctx.command('names.batch <names:text>', '批量添加姓名到白名单')
      .example('names.batch 张三,李四,王五')
      .example('names.batch 张三 李四 王五')
      .action(async ({ session }, names) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!names) {
          return [
            '❌ 请提供姓名列表',
            '',
            '📋 支持格式:',
            '• 逗号分隔: names.batch 张三,李四,王五',
            '• 空格分隔: names.batch 张三 李四 王五',
            '• 换行分隔: 支持多行输入'
          ].join('\n')
        }

        const results = validateNames(names)

        if (results.success.length === 0) {
          return '❌ 未检测到有效的姓名'
        }

        // 检查重复并添加
        const finalResults = { success: [] as string[], duplicate: [] as string[] }
        
        for (const name of results.success) {
          if (await this.isNameInWhitelist(guildId, name)) {
            finalResults.duplicate.push(name)
          } else {
            await this.addToNameWhitelist(guildId, name)
            finalResults.success.push(name)
          }
        }

        const report = formatValidationReport(finalResults, '姓名')
        report.push(`📋 当前姓名白名单总数: ${await this.getNameWhitelistCount(guildId)}`)

        return report.join('\n')
      })

    this.ctx.command('names.remove <name:string>', '从姓名白名单中移除')
      .action(async ({ session }, name) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!name) {
          return '❌ 请提供姓名'
        }

        const trimmedName = name.trim()
        if (!(await this.isNameInWhitelist(guildId, trimmedName))) {
          return '⚠️ 该姓名不在白名单中'
        }

        await this.removeFromNameWhitelist(guildId, trimmedName)
        return `✅ 已将 "${trimmedName}" 从姓名白名单移除`
      })

    this.ctx.command('names.list', '查看姓名白名单')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        const nameList = await this.getNameWhitelist(guildId)
        return this.formatList(nameList, '姓名白名单')
      })

    this.ctx.command('names.clear', '清空姓名白名单')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        const count = await this.getNameWhitelistCount(guildId)
        await this.clearNameWhitelist(guildId)
        return `✅ 已清空姓名白名单 (移除了 ${count} 个姓名)`
      })

    this.ctx.command('names.validation-toggle', '切换严格姓名验证模式')
      .action(async ({ session }) => {
        const guildId = session?.guildId
        this.config.groupManagement.useNameValidation = !this.config.groupManagement.useNameValidation
        return [
          `🔄 严格姓名验证模式已${this.formatBooleanStatus(this.config.groupManagement.useNameValidation)}`,
          '',
          this.config.groupManagement.useNameValidation 
            ? '✅ 现在只有填写了白名单中姓名的申请才会通过（忽略其他所有规则）'
            : '❌ 现在将使用原有的QQ号白名单和关键词过滤规则',
          '',
          `当前配置:`,
          `• 严格姓名验证: ${this.formatBooleanStatus(this.config.groupManagement.useNameValidation)}`,
          `• QQ号白名单检查: ${this.formatBooleanStatus(this.config.groupManagement.useWhitelist)}`,
          `• 关键词过滤: ${this.formatBooleanStatus(this.config.groupManagement.useKeywordFilter)}`,
          `• 姓名白名单数量: ${await this.getNameWhitelistCount(guildId)}`,
          '',
          this.config.groupManagement.useNameValidation && await this.getNameWhitelistCount(guildId) === 0
            ? '⚠️ 提示: 请使用 names.add 或 names.batch 添加姓名到白名单'
            : ''
        ].filter(line => line !== '').join('\n')
      })
  }

  private async getNameWhitelist(guildId: string): Promise<string[]> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.getNameWhitelist(guildId)
      } catch (error) {
        logger.warn('从数据库获取姓名白名单失败，使用配置文件', error)
      }
    }
    return this.config.nameWhitelist
  }

  private async getNameWhitelistCount(guildId?: string): Promise<number> {
    if (guildId && this.database && this.config.database.enabled) {
      try {
        const list = await this.database.getNameWhitelist(guildId)
        return list.length
      } catch (error) {
        logger.warn('从数据库获取姓名白名单失败', error)
      }
    }
    return this.config.nameWhitelist.length
  }

  private async isNameInWhitelist(guildId: string, name: string): Promise<boolean> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.isNameInWhitelist(guildId, name)
      } catch (error) {
        logger.warn('从数据库检查姓名白名单失败，使用配置文件', error)
      }
    }
    return this.config.nameWhitelist.includes(name)
  }

  private async addToNameWhitelist(guildId: string, name: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.addToNameWhitelist(guildId, name)
        return
      } catch (error) {
        logger.warn('添加到数据库失败，添加到配置文件', error)
      }
    }
    
    if (!this.config.nameWhitelist.includes(name)) {
      this.config.nameWhitelist.push(name)
    }
  }

  private async removeFromNameWhitelist(guildId: string, name: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.removeFromNameWhitelist(guildId, name)
        return
      } catch (error) {
        logger.warn('从数据库删除失败，从配置文件删除', error)
      }
    }
    
    const index = this.config.nameWhitelist.indexOf(name)
    if (index !== -1) {
      this.config.nameWhitelist.splice(index, 1)
    }
  }

  private async clearNameWhitelist(guildId: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        const list = await this.database.getNameWhitelist(guildId)
        for (const name of list) {
          await this.database.removeFromNameWhitelist(guildId, name)
        }
        return
      } catch (error) {
        logger.warn('清空数据库姓名白名单失败，清空配置文件', error)
      }
    }
    
    this.config.nameWhitelist.length = 0
  }
}