import type { NextRequest } from 'next/server';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ''
    }),
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        if (user.status === 'SUSPENDED') {
          throw new Error('This account has been suspended.');
        }

        return { id: user.id, email: user.email, name: user.name };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.userId as string;
      return session;
    }
  }
};

/**
 * Creates a new user with sane defaults: signup bonus credits, a unique
 * referral code, and an unverified email that must be confirmed before
 * full access — matching the spec's "email verification" requirement.
 */
export async function createUser(params: { name: string; email: string; password: string }) {
  const passwordHash = await bcrypt.hash(params.password, 12);
  const signupBonus = Number(process.env.SIGNUP_BONUS_CREDITS ?? 100);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: params.name,
        email: params.email,
        passwordHash,
        referralCode: nanoid(8).toUpperCase(),
        creditBalance: signupBonus,
        status: 'PENDING_VERIFICATION'
      }
    });

    await tx.creditTransaction.create({
      data: { userId: user.id, amount: signupBonus, reason: 'SIGNUP_BONUS' }
    });

    return user;
  });
}

/**
 * Resolves the authenticated user for an API route. Swap the body for
 * `getServerSession(authOptions)` plus an API-key header check once
 * NextAuth is wired into your route handlers.
 */
export async function getServerAuthUser(_req: NextRequest) {
  // TODO: replace with real session/API-key resolution, e.g.:
  // const session = await getServerSession(authOptions);
  // if (session?.user) return prisma.user.findUnique({ where: { id: session.user.id } });
  //
  // const apiKey = req.headers.get('authorization')?.replace('Bearer ', '');
  // if (apiKey) return resolveUserFromApiKey(apiKey);
  return null;
}
