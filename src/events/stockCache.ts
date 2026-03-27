import "dotenv/config";


// Note: As decided, we are dropping Redis-based stock caching.
// This file is mostly a shell or can be deleted if we don't need pub/sub for anything else.
// I'll leave empty functions for compatibility with anyone importing it, 
// but they will do nothing.

export async function invalidateStock(smeId: string, productId: string) {
    // No-op: caching is disabled to reduce infrastructure complexity
}

export async function publishStockUpdated(smeId: string, productId: string, newStock: number) {
    // No-op: caching is disabled
}
