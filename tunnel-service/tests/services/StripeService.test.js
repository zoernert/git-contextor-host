const StripeService = require('../../src/services/StripeService');
const stripe = require('../../src/config/stripe');

jest.mock('../../src/config/stripe');

describe('StripeService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateMRR', () => {
        it('should correctly calculate MRR from monthly and yearly subscriptions', async () => {
            const mockSubscriptions = {
                data: [
                    { id: 'sub_1', items: { data: [{ price: { unit_amount: 1000, recurring: { interval: 'month' } } }] } }, // $10
                    { id: 'sub_2', items: { data: [{ price: { unit_amount: 12000, recurring: { interval: 'year' } } }] } }, // $120 -> $10/mo
                    { id: 'sub_3', items: { data: [{ price: { unit_amount: 500, recurring: { interval: 'month' } } }] } },  // $5
                ],
                has_more: false,
            };
            stripe.subscriptions.list.mockResolvedValue(mockSubscriptions);

            const mrr = await StripeService.calculateMRR();

            expect(mrr).toBe(25);
            expect(stripe.subscriptions.list).toHaveBeenCalledWith({
                limit: 100,
                status: 'active',
                starting_after: undefined,
            });
        });
        
        it('should handle pagination correctly', async () => {
            const mockPage1 = {
                data: [{ id: 'sub_1', items: { data: [{ price: { unit_amount: 1000, recurring: { interval: 'month' } } }] } }],
                has_more: true,
            };
            const mockPage2 = {
                data: [{ id: 'sub_2', items: { data: [{ price: { unit_amount: 2000, recurring: { interval: 'month' } } }] } }],
                has_more: false,
            };

            stripe.subscriptions.list
                .mockResolvedValueOnce(mockPage1)
                .mockResolvedValueOnce(mockPage2);

            const mrr = await StripeService.calculateMRR();
            expect(mrr).toBe(30);
            
            expect(stripe.subscriptions.list).toHaveBeenCalledTimes(2);
            expect(stripe.subscriptions.list).toHaveBeenCalledWith({ limit: 100, status: 'active', starting_after: 'sub_1' });
        });

        it('should return 0 when there are no subscriptions', async () => {
            stripe.subscriptions.list.mockResolvedValue({ data: [], has_more: false });
            const mrr = await StripeService.calculateMRR();
            expect(mrr).toBe(0);
        });
    });
});
