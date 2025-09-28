import { prisma } from '../db';
import { AgeGroup } from '@prisma/client';

export async function getUserById(id: number) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByOpenId(openid: string) {
  return prisma.user.findUnique({ where: { openid } });
}

export async function upsertUserByOpenid(openid: string, unionid?: string) {
  return prisma.user.upsert({
    where: { openid },
    update: { unionid },
    create: {
      openid,
      unionid,
      wechatNick: '新用户',
      ageGroup: AgeGroup.ADULT,
      canParticipate: true,
      canBuyMembership: true,
      city: '未知',
    },
  });
}

export async function updateUserProfile(
  id: number,
  data: {
    phone?: string;               // plain phone from client
    wechatNick?: string;
    avatarUrl?: string;
    city?: string;
    realNameVerified?: boolean;
    birthDate?: Date;
  }
) {
  const { phone, ...rest } = data;
  return prisma.user.update({
    where: { id },
    data: {
      ...rest,
      // TODO: replace with AES later
      phoneEnc: phone ?? undefined,
    },
  });
}
