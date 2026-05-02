import type {
  Center,
  PasswordResetRecord,
  User,
  VerificationRecord,
} from "@db/auth/types";

interface DB {
  userTokens: string[];
  centers: Center[];
  users: User[];
  verifications: VerificationRecord[];
  passwordResets: PasswordResetRecord[];
}
export const db: DB = {
  // TODO: Use jsonwebtoken pkg
  // ℹ️ Created from https://jwt.io/ using HS256 algorithm
  // ℹ️ We didn't created it programmatically because jsonwebtoken package have issues with esm support. View Issues: https://github.com/auth0/node-jsonwebtoken/issues/655
  userTokens: [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MX0.fhc3wykrAnRpcKApKhXiahxaOe8PSHatad31NuIZ0Zg",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Mn0.cat2xMrZLn0FwicdGtZNzL7ifDTAKWB0k1RurSWjdnw",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6M30.PGOfMaZA_T9W05vMj5FYXG5d47soSPJD1WuxeUfw4L4",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NH0.d_9aq2tpeA9-qpqO0X4AmW6gU2UpWkXwc04UJYFWiZE",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6NX0.ocO77FbjOSU1-JQ_BilEZq2G_M8bCiB10KYqtfkv1ss",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Nn0.YgQILRqZy8oefhTZgJJfiEzLmhxQT_Bd2510OvrrwB8",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6N30.KH9RmOWIYv_HONxajg7xBIJXHEUvSdcBygFtS2if8Jk",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OH0.shrp-oMHkVAkiMkv_aIvSx3k6Jk-X7TrH5UeufChz_g",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6OX0.9JD1MR3ZkwHzhl4mOHH6lGG8hOVNZqDNH6UkFzjCqSE",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTB9.txWLuN4QT5PqTtgHmlOiNerIu5Do51PpYOiZutkyXYg",
  ],

  centers: [
    {
      id: 1,
      name: "Squarely Demo Center",
      slug: "squarely-demo-center",
    },
  ],

  users: [
    {
      id: 1,
      fullName: "John Doe",
      username: "johndoe",
      password: "admin",

      avatar: `${import.meta.env.BASE_URL ?? "/"}images/avatars/avatar-1.png`,
      email: "admin@demo.com",
      role: "admin",
      emailVerified: true,
      authProviders: ["password", "google"],
      currentCenterId: 1,
      memberships: [
        {
          centerId: 1,
          role: "super-admin",
          status: "active",
          abilityRules: [
            {
              action: "manage",
              subject: "all",
            },
          ],
        },
      ],
      abilityRules: [
        {
          action: "manage",
          subject: "all",
        },
      ],
    },
    {
      id: 2,
      fullName: "Jane Doe",
      username: "janedoe",
      password: "client",

      avatar: `${import.meta.env.BASE_URL ?? "/"}images/avatars/avatar-2.png`,
      email: "client@demo.com",
      role: "client",
      emailVerified: true,
      authProviders: ["password"],
      currentCenterId: 1,
      memberships: [
        {
          centerId: 1,
          role: "employee",
          status: "active",
          abilityRules: [
            {
              action: "read",
              subject: "AclDemo",
            },
          ],
        },
      ],
      abilityRules: [
        {
          action: "read",
          subject: "AclDemo",
        },
      ],
    },
  ],

  verifications: [
    {
      email: "admin@demo.com",
      code: "111111",
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    },
    {
      email: "client@demo.com",
      code: "222222",
      expiresAt: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    },
  ],

  passwordResets: [],
};

export const getTokenForUserId = (userId: number) => {
  const index = Math.max(0, userId - 1);
  const existingToken = db.userTokens[index];
  if (existingToken) return existingToken;

  const token = `mock-token-${userId}`;
  db.userTokens[index] = token;
  return token;
};

export const getUserByAccessToken = (token?: string | null) => {
  if (!token) return null;

  const index = db.userTokens.findIndex((entry) => entry === token);
  if (index === -1) return null;

  return db.users.find((user) => user.id === index + 1) ?? null;
};
