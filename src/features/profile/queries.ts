/** Query-cache key for the profile, shared by the screens that read or change it. */
export const profileKey = ['profile'] as const;

/** Query-cache key for what Capsule remembers; a stylist conversation can change it. */
export const memoryKey = ['memory'] as const;
