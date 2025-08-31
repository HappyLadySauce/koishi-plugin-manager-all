import { Logger } from 'koishi'
import { BaseCommandHandler } from './base'
import { cleanQQNumber, validateQQNumbers, formatValidationReport } from '../utils/validation'

const logger = new Logger('group-master:whitelist-commands')

export class WhitelistCommandHandler extends BaseCommandHandler {
  register() {
    // QQ号白名单管理命令
    this.ctx.command('whitelist', 'QQ号白名单管理')
      .action(async () => {
        const helpMessage = [
          '📋 QQ号白名单管理命令:',
          '',
          '➕ 添加操作:',
          '• whitelist.add <QQ号> - 添加单个白名单',
          '• whitelist.batch <QQ号列表> - 批量添加白名单',
          '• whitelist.import - 从当前群组导入成员',
          '• whitelist.quick <QQ号> - 快速添加（自动格式化）',
          '',
          '➖ 移除操作:',
          '• whitelist.remove <QQ号> - 移除白名单',
          '• whitelist.clear - 清空白名单',
          '',
          '📄 查看操作:',
          '• whitelist.list - 查看白名单列表',
          '',
          '⚙️ 配置操作:',
          '• whitelist.reject-toggle - 切换自动拒绝功能',
          '',
          '📊 批量添加示例:',
          '• whitelist.batch 123,456,789',
          '• whitelist.batch 123 456 789',
          '',
          `当前白名单状态: ${this.formatBooleanStatus(this.config.groupManagement.useWhitelist)}`,
          `白名单数量: ${await this.getWhitelistCount()} 个`
        ].join('\n')
        
        return helpMessage
      })

    this.ctx.command('whitelist.add <qq:string>', '添加QQ号到白名单')
      .action(async ({ session }, qq) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!qq || !/^\d+$/.test(qq)) {
          return '❌ 请提供有效的QQ号'
        }

        if (await this.isInWhitelist(guildId, qq)) {
          return '⚠️ 该QQ号已在白名单中'
        }

        await this.addToWhitelist(guildId, qq)
        return `✅ 已将 ${qq} 添加到白名单`
      })

    this.ctx.command('whitelist.quick <qq:string>', '快速添加QQ号到白名单（智能解析）')
      .action(async ({ session }, qq) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!qq) {
          return '❌ 请提供QQ号'
        }

        const cleanedQq = cleanQQNumber(qq)
        
        if (!cleanedQq) {
          return [
            '❌ 无效的QQ号格式',
            '',
            '💡 支持的格式:',
            '• 纯数字: 123456789',
            '• 带@符号: @123456789',
            '• QQ号码: QQ123456789',
            '• 其他格式: 会自动提取数字部分'
          ].join('\n')
        }

        if (await this.isInWhitelist(guildId, cleanedQq)) {
          return `⚠️ QQ号 ${cleanedQq} 已在白名单中`
        }

        await this.addToWhitelist(guildId, cleanedQq)
        return `✅ 已将 QQ号 ${cleanedQq} 添加到白名单`
      })

    this.ctx.command('whitelist.batch <qqs:text>', '批量添加QQ号到白名单')
      .example('whitelist.batch 123456789,987654321,555666777')
      .example('whitelist.batch 123456789 987654321 555666777')
      .action(async ({ session }, qqs) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
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

        const results = validateQQNumbers(qqs)

        if (results.success.length === 0) {
          return '❌ 未检测到有效的QQ号'
        }

        // 检查重复并添加
        const finalResults = { success: [] as string[], duplicate: [] as string[] }
        
        for (const qq of results.success) {
          if (await this.isInWhitelist(guildId, qq)) {
            finalResults.duplicate.push(qq)
          } else {
            await this.addToWhitelist(guildId, qq)
            finalResults.success.push(qq)
          }
        }

        const report = formatValidationReport(finalResults, 'QQ号')
        report.push(`📋 当前白名单总数: ${await this.getWhitelistCount(guildId)}`)

        return report.join('\n')
      })

    this.ctx.command('whitelist.remove <qq:string>', '从白名单移除QQ号')
      .action(async ({ session }, qq) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        
        if (!qq) {
          return '❌ 请提供QQ号'
        }

        if (!(await this.isInWhitelist(guildId, qq))) {
          return '⚠️ 该QQ号不在白名单中'
        }

        await this.removeFromWhitelist(guildId, qq)
        return `✅ 已将 ${qq} 从白名单移除`
      })

    this.ctx.command('whitelist.list', '查看QQ号白名单')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        const whitelist = await this.getWhitelist(guildId)
        return this.formatList(whitelist, 'QQ号白名单')
      })

    this.ctx.command('whitelist.clear', '清空QQ号白名单')
      .action(async ({ session }) => {
        const guildId = await this.ensureGuildContext(session?.guildId)
        const count = await this.getWhitelistCount(guildId)
        await this.clearWhitelist(guildId)
        return `✅ 已清空白名单 (移除了 ${count} 个QQ号)`
      })

    this.ctx.command('whitelist.reject-toggle', '切换白名单自动拒绝功能')
      .action(async () => {
        this.config.groupManagement.autoRejectNonWhitelist = !this.config.groupManagement.autoRejectNonWhitelist
        return [
          `🔄 白名单自动拒绝功能已${this.formatBooleanStatus(this.config.groupManagement.autoRejectNonWhitelist)}`,
          '',
          this.config.groupManagement.autoRejectNonWhitelist 
            ? '✅ 现在不在白名单中的用户将被自动拒绝'
            : '⚠️ 现在不在白名单中的用户将通过关键词过滤或默认规则处理',
          '',
          `当前配置:`,
          `• 白名单检查: ${this.formatBooleanStatus(this.config.groupManagement.useWhitelist)}`,
          `• 自动拒绝非白名单: ${this.formatBooleanStatus(this.config.groupManagement.autoRejectNonWhitelist)}`,
          `• 关键词过滤: ${this.formatBooleanStatus(this.config.groupManagement.useKeywordFilter)}`
        ].join('\n')
      })
  }

  private async getWhitelist(guildId: string): Promise<string[]> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.getWhitelist(guildId)
      } catch (error) {
        logger.warn('从数据库获取白名单失败，使用配置文件', error)
      }
    }
    return this.config.whitelist
  }

  private async getWhitelistCount(guildId?: string): Promise<number> {
    if (guildId && this.database && this.config.database.enabled) {
      try {
        const list = await this.database.getWhitelist(guildId)
        return list.length
      } catch (error) {
        logger.warn('从数据库获取白名单失败', error)
      }
    }
    return this.config.whitelist.length
  }

  private async isInWhitelist(guildId: string, userId: string): Promise<boolean> {
    if (this.database && this.config.database.enabled) {
      try {
        return await this.database.isInWhitelist(guildId, userId)
      } catch (error) {
        logger.warn('从数据库检查白名单失败，使用配置文件', error)
      }
    }
    return this.config.whitelist.includes(userId)
  }

  private async addToWhitelist(guildId: string, userId: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.addToWhitelist(guildId, userId)
        return
      } catch (error) {
        logger.warn('添加到数据库失败，添加到配置文件', error)
      }
    }
    
    if (!this.config.whitelist.includes(userId)) {
      this.config.whitelist.push(userId)
    }
  }

  private async removeFromWhitelist(guildId: string, userId: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        await this.database.removeFromWhitelist(guildId, userId)
        return
      } catch (error) {
        logger.warn('从数据库删除失败，从配置文件删除', error)
      }
    }
    
    const index = this.config.whitelist.indexOf(userId)
    if (index !== -1) {
      this.config.whitelist.splice(index, 1)
    }
  }

  private async clearWhitelist(guildId: string): Promise<void> {
    if (this.database && this.config.database.enabled) {
      try {
        const list = await this.database.getWhitelist(guildId)
        for (const userId of list) {
          await this.database.removeFromWhitelist(guildId, userId)
        }
        return
      } catch (error) {
        logger.warn('清空数据库白名单失败，清空配置文件', error)
      }
    }
    
    this.config.whitelist.length = 0
  }
}