# Fixture 12: Cache TTL Eviction

An in-memory key-value cache implementation with time-to-live (TTL) expiration.
Contains a memory retention leak where expired keys are hidden from `get()`, but the internal entries are never evicted from storage, resulting in unbounded memory growth.
