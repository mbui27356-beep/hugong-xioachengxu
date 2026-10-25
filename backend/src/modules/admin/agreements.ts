import type { Agreement, AgreementType } from '../../../../packages/contracts'
import { AGREEMENT_TYPE_LABEL } from '../../../../packages/contracts'
import { contentHash } from '../../../../packages/domain/hash'
import { fail, mutate, query, requireText } from '../../core/ctx'

// 协议：草稿可改；发布后生成不可覆盖的新版本，订单保存版本号与摘要哈希。

export const getAgreements = (type: AgreementType) =>
  query((ctx) => {
    ctx.require('agreement.view')
    const list = ctx.db.agreements.filter((a) => a.type === type)
    const versions = list.filter((a) => a.status !== 'DRAFT').sort((a, b) => b.version - a.version)
    const draft = list.find((a) => a.status === 'DRAFT') ?? null
    const published = versions.find((a) => a.status === 'PUBLISHED') ?? null
    const counts = (Object.keys(AGREEMENT_TYPE_LABEL) as AgreementType[]).map((t) => ({
      type: t,
      version: ctx.db.agreements.filter((a) => a.type === t && a.status === 'PUBLISHED').map((a) => a.version)[0] ?? null,
      hasDraft: ctx.db.agreements.some((a) => a.type === t && a.status === 'DRAFT'),
    }))
    const ordersUsing = published
      ? ctx.db.orders.filter((o) => o.agreementVersions.some((v) => v.type === type && v.version === published.version)).length
      : 0
    return { draft, versions, published, counts, ordersUsing }
  })

export const saveDraft = (type: AgreementType, input: { title: string; body: string }) =>
  mutate((ctx) => {
    ctx.require('agreement.publish')
    const title = requireText(input.title, '标题', 40)
    const body = requireText(input.body, '正文', 20000)
    let draft = ctx.db.agreements.find((a) => a.type === type && a.status === 'DRAFT')
    if (!draft) {
      draft = {
        id: ctx.id('agr'), type, version: 0, title, body, contentHash: '', status: 'DRAFT', publishedAt: null,
        publisherName: null, createdAt: ctx.now, updatedAt: ctx.now, demo: true,
      } satisfies Agreement
      ctx.db.agreements.push(draft)
    }
    draft.title = title
    draft.body = body
    draft.contentHash = contentHash(title + '\n' + body)
    draft.updatedAt = ctx.now
    return draft
  })

export const discardDraft = (type: AgreementType) =>
  mutate((ctx) => {
    ctx.require('agreement.publish')
    ctx.db.agreements = ctx.db.agreements.filter((a) => !(a.type === type && a.status === 'DRAFT'))
    return true
  })

export const publishDraft = (type: AgreementType, note: string) =>
  mutate((ctx) => {
    ctx.require('agreement.publish')
    const draft = ctx.db.agreements.find((a) => a.type === type && a.status === 'DRAFT')
    if (!draft) fail('NOT_FOUND', '没有可发布的草稿')
    const hash = contentHash(draft.title + '\n' + draft.body)
    const current = ctx.db.agreements.find((a) => a.type === type && a.status === 'PUBLISHED')
    if (current && current.contentHash === hash) fail('VALIDATION_FAILED', '草稿与当前发布版本内容一致，无需发布')
    const reason = requireText(note, '变更说明', 200)
    const version = ctx.db.agreements.filter((a) => a.type === type).reduce((m, a) => Math.max(m, a.version), 0) + 1
    if (current) {
      current.status = 'ARCHIVED'
      current.updatedAt = ctx.now
    }
    // 发布：草稿转为新版本记录，内容此后不可修改
    draft.status = 'PUBLISHED'
    draft.version = version
    draft.contentHash = hash
    draft.publishedAt = ctx.now
    draft.publisherName = ctx.actor.name
    draft.updatedAt = ctx.now
    ctx.audit({ action: 'agreement.publish', targetType: '协议', targetId: `${type}-v${version}`, summary: `发布${AGREEMENT_TYPE_LABEL[type]} v${version}（${hash}）`, reason })
    return draft
  })
