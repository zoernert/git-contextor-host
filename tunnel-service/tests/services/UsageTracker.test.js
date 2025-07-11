const UsageTracker = require('../../src/services/UsageTracker');
const Usage = require('../../src/models/Usage');
const User = require('../../src/models/User');
const plansConfig = require('../../src/config/plans');

describe('UsageTracker', () => {
    let user;
    let tunnel;

    beforeEach(async () => {
        // Clear database
        await User.deleteMany({});
        await Usage.deleteMany({});

        // Create test user
        user = await User.create({
            email: 'test@example.com',
            password: 'hashedpassword',
            apiKey: 'test-api-key-12345678901234567890',
            stripeCustomerId: 'cus_test123',
            plan: 'basic'
        });

        // Mock tunnel object
        tunnel = {
            _id: 'tunnel-id-123',
            userId: user._id
        };
    });

    describe('trackData', () => {
        it('should track data transfer successfully', async () => {
            const dataAmount = 1024; // 1KB

            await UsageTracker.trackData(tunnel, dataAmount);

            const usage = await Usage.findOne({ tunnelId: tunnel._id });
            expect(usage).toBeDefined();
            expect(usage.userId).toEqual(user._id);
            expect(usage.dataTransferred).toBe(dataAmount);
        });

        it('should handle multiple data tracking calls', async () => {
            await UsageTracker.trackData(tunnel, 1024);
            await UsageTracker.trackData(tunnel, 2048);

            const usageRecords = await Usage.find({ tunnelId: tunnel._id });
            expect(usageRecords).toHaveLength(2);
            expect(usageRecords[0].dataTransferred).toBe(1024);
            expect(usageRecords[1].dataTransferred).toBe(2048);
        });

        it('should handle zero data transfer', async () => {
            await UsageTracker.trackData(tunnel, 0);

            const usage = await Usage.findOne({ tunnelId: tunnel._id });
            expect(usage).toBeDefined();
            expect(usage.dataTransferred).toBe(0);
        });
    });

    describe('canTransfer', () => {
        it('should allow transfer within limits for basic plan', async () => {
            const basicPlan = plansConfig.basic;
            const transferAmount = 1024 * 1024; // 1MB
            
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            
            expect(canTransfer).toBe(true);
        });

        it('should allow transfer for free plan within limits', async () => {
            // Update user to free plan
            await User.findByIdAndUpdate(user._id, { plan: 'free' });
            
            const transferAmount = 1024 * 1024; // 1MB
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            
            expect(canTransfer).toBe(true);
        });

        it('should deny transfer when exceeding plan limits', async () => {
            // Update user to free plan (1GB limit)
            await User.findByIdAndUpdate(user._id, { plan: 'free' });
            
            // Create usage that puts user close to limit
            const freePlan = plansConfig.free;
            const limitInBytes = freePlan.limits.maxDataTransfer * 1024 * 1024 * 1024; // Convert GB to bytes
            const currentUsage = limitInBytes - 1024; // 1KB under limit
            
            await Usage.create({
                tunnelId: tunnel._id,
                userId: user._id,
                dataTransferred: currentUsage
            });
            
            const transferAmount = 2048; // 2KB (would exceed limit)
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            
            expect(canTransfer).toBe(false);
        });

        it('should allow unlimited transfer for enterprise plan', async () => {
            // Update user to enterprise plan
            await User.findByIdAndUpdate(user._id, { plan: 'enterprise' });
            
            const transferAmount = 1024 * 1024 * 1024 * 100; // 100GB
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            
            expect(canTransfer).toBe(true);
        });

        it('should handle non-existent user', async () => {
            const fakeUserId = '507f1f77bcf86cd799439011';
            const transferAmount = 1024;
            
            const canTransfer = await UsageTracker.canTransfer(fakeUserId, transferAmount);
            
            expect(canTransfer).toBe(false);
        });

        it('should handle invalid plan', async () => {
            // Update user to invalid plan
            await User.findByIdAndUpdate(user._id, { plan: 'invalid' });
            
            const transferAmount = 1024;
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            
            expect(canTransfer).toBe(false);
        });
    });

    describe('getCurrentUsage', () => {
        it('should calculate current usage correctly', async () => {
            // Create multiple usage records
            await Usage.create([
                { tunnelId: tunnel._id, userId: user._id, dataTransferred: 1024 },
                { tunnelId: tunnel._id, userId: user._id, dataTransferred: 2048 },
                { tunnelId: 'other-tunnel', userId: user._id, dataTransferred: 512 }
            ]);

            const usage = await UsageTracker.getCurrentUsage(user._id);
            
            expect(usage).toBe(3584); // 1024 + 2048 + 512
        });

        it('should return 0 for user with no usage', async () => {
            const usage = await UsageTracker.getCurrentUsage(user._id);
            
            expect(usage).toBe(0);
        });

        it('should handle non-existent user', async () => {
            const fakeUserId = '507f1f77bcf86cd799439011';
            const usage = await UsageTracker.getCurrentUsage(fakeUserId);
            
            expect(usage).toBe(0);
        });
    });

    describe('resetUsage', () => {
        beforeEach(async () => {
            // Create some usage records
            await Usage.create([
                { tunnelId: tunnel._id, userId: user._id, dataTransferred: 1024 },
                { tunnelId: 'other-tunnel', userId: user._id, dataTransferred: 2048 }
            ]);
        });

        it('should reset user usage', async () => {
            await UsageTracker.resetUsage(user._id);
            
            const usage = await Usage.find({ userId: user._id });
            expect(usage).toHaveLength(0);
        });

        it('should not affect other users', async () => {
            // Create another user with usage
            const otherUser = await User.create({
                email: 'other@example.com',
                password: 'hashedpassword',
                apiKey: 'other-api-key-12345678901234567890',
                stripeCustomerId: 'cus_other123',
                plan: 'basic'
            });

            await Usage.create({
                tunnelId: 'other-user-tunnel',
                userId: otherUser._id,
                dataTransferred: 4096
            });

            await UsageTracker.resetUsage(user._id);
            
            const userUsage = await Usage.find({ userId: user._id });
            const otherUserUsage = await Usage.find({ userId: otherUser._id });
            
            expect(userUsage).toHaveLength(0);
            expect(otherUserUsage).toHaveLength(1);
        });
    });

    describe('getUsageStats', () => {
        beforeEach(async () => {
            // Create usage records with different timestamps
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

            await Usage.create([
                { tunnelId: tunnel._id, userId: user._id, dataTransferred: 1024, createdAt: now },
                { tunnelId: tunnel._id, userId: user._id, dataTransferred: 2048, createdAt: yesterday },
                { tunnelId: tunnel._id, userId: user._id, dataTransferred: 512, createdAt: lastWeek }
            ]);
        });

        it('should return usage stats for specified period', async () => {
            const startDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
            const endDate = new Date();

            const stats = await UsageTracker.getUsageStats(user._id, startDate, endDate);
            
            expect(stats.totalDataTransferred).toBe(3072); // 1024 + 2048
            expect(stats.totalRequests).toBe(2);
        });

        it('should return empty stats when no usage in period', async () => {
            const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
            const endDate = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000); // 20 days ago

            const stats = await UsageTracker.getUsageStats(user._id, startDate, endDate);
            
            expect(stats.totalDataTransferred).toBe(0);
            expect(stats.totalRequests).toBe(0);
        });

        it('should handle non-existent user', async () => {
            const fakeUserId = '507f1f77bcf86cd799439011';
            const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const endDate = new Date();

            const stats = await UsageTracker.getUsageStats(fakeUserId, startDate, endDate);
            
            expect(stats.totalDataTransferred).toBe(0);
            expect(stats.totalRequests).toBe(0);
        });
    });

    describe('Plan limits integration', () => {
        it('should respect free plan limits', async () => {
            await User.findByIdAndUpdate(user._id, { plan: 'free' });
            
            const freePlan = plansConfig.free;
            expect(freePlan.limits.maxDataTransfer).toBe(1); // 1GB
            
            const limitInBytes = freePlan.limits.maxDataTransfer * 1024 * 1024 * 1024;
            const transferAmount = limitInBytes + 1;
            
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            expect(canTransfer).toBe(false);
        });

        it('should respect basic plan limits', async () => {
            await User.findByIdAndUpdate(user._id, { plan: 'basic' });
            
            const basicPlan = plansConfig.basic;
            expect(basicPlan.limits.maxDataTransfer).toBe(10); // 10GB
            
            const limitInBytes = basicPlan.limits.maxDataTransfer * 1024 * 1024 * 1024;
            const transferAmount = limitInBytes + 1;
            
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            expect(canTransfer).toBe(false);
        });

        it('should respect pro plan limits', async () => {
            await User.findByIdAndUpdate(user._id, { plan: 'pro' });
            
            const proPlan = plansConfig.pro;
            expect(proPlan.limits.maxDataTransfer).toBe(50); // 50GB
            
            const limitInBytes = proPlan.limits.maxDataTransfer * 1024 * 1024 * 1024;
            const transferAmount = limitInBytes + 1;
            
            const canTransfer = await UsageTracker.canTransfer(user._id, transferAmount);
            expect(canTransfer).toBe(false);
        });
    });
});
