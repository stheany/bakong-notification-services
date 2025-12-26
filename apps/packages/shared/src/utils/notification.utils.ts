import { BakongApp } from "../enums/bakong-app.enum"

export const inferBakongPlatform = (
  participantCode?: string,
  accountId?: string
): BakongApp | undefined => {
  if (participantCode) {
    const normalized = participantCode.toUpperCase()
    if (normalized.startsWith("BKRT")) return BakongApp.BAKONG
    if (normalized.startsWith("BKJR")) return BakongApp.BAKONG_JUNIOR
    if (normalized.startsWith("TOUR")) return BakongApp.BAKONG_TOURIST
  }

  if (accountId) {
    const normalized = accountId.toLowerCase()
    if (normalized.includes("@bkrt")) return BakongApp.BAKONG
    if (normalized.includes("@bkjr")) return BakongApp.BAKONG_JUNIOR
    if (normalized.includes("@tour")) return BakongApp.BAKONG_TOURIST
  }

  return undefined
}
