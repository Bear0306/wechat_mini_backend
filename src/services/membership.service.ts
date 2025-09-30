import { prisma } from "../db";
import { MembershipTier } from "@prisma/client";
import { DateTime } from "luxon";

type TierCfg = { monthlyQuota: number; carryOverMax: number; autoJoin: boolean };

export function tierConfig(t: MembershipTier): TierCfg {
  if (t === MembershipTier.VIP)
    return { monthlyQuota: 12, carryOverMax: 12, autoJoin: false };

  if (t === MembershipTier.VIP_PLUS)
    return { monthlyQuota: 20, carryOverMax: 20, autoJoin: true };

  return { monthlyQuota: 0, carryOverMax: 0, autoJoin: false };
}

export async function upsertMembership(
  userId: number | string,   // accept both
  tier: MembershipTier,
  months = 1
) {
  // Coerce to number because Prisma type expects number for userId
  const uid: number = typeof userId === "string" ? Number(userId) : userId;
  if (!Number.isFinite(uid)) {
    throw new TypeError("userId must be a number or a numeric string");
  }

  const now = DateTime.now();
  const ex = await prisma.membership.findUnique({
    where: { userId: uid },  // ✅ number
  });

  const cfg = tierConfig(tier);

  if (!ex) {
    return prisma.membership.create({
      data: {
        userId: uid,                 // ✅ number
        tier,
        startAt: now.toJSDate(),
        endAt: now.plus({ months }).toJSDate(),
        monthlyQuota: cfg.monthlyQuota,
        carryOver: 0,
        autoJoin: cfg.autoJoin,
      },
    });
  }

  const carry = Math.min(ex.carryOver + ex.monthlyQuota, cfg.carryOverMax); // ✅ fixed key
  const currentEnd = DateTime.fromJSDate(ex.endAt);
  const newEnd = (currentEnd < now ? now : currentEnd).plus({ months });

  return prisma.membership.update({
    where: { userId: uid },   // ✅ number
    data: {
      tier,
      endAt: newEnd.toJSDate(),
      monthlyQuota: cfg.monthlyQuota,
      carryOver: carry,
      autoJoin: cfg.autoJoin,
    },
  });
}