const API_BASE = '/.netlify/functions';

export const api = {
    // Auth
    register: async (phone, password) => {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone, password }),
        });
        return res.json();
    },

    login: async (phone, password) => {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone, password }),
        });
        return res.json();
    },

    getMe: async () => {
        const res = await fetch(`${API_BASE}/auth/me`, {
            credentials: 'include',
        });
        return res.json();
    },

    logout: async () => {
        const res = await fetch(`${API_BASE}/auth/logout`, {
            method: 'POST',
            credentials: 'include',
        });
        return res.json();
    },

    // Game
    getCurrentRound: async () => {
        const res = await fetch(`${API_BASE}/game/current`);
        return res.json();
    },

    placeBet: async (betType, betValue, amount) => {
        const res = await fetch(`${API_BASE}/game/bet`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ betType, betValue, amount }),
        });
        return res.json();
    },

    // Bets
    submitRecharge: async (amount, transactionId) => {
        const res = await fetch(`${API_BASE}/bets/recharge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ amount, transactionId }),
        });
        return res.json();
    },

    submitWithdrawal: async (amount) => {
        const res = await fetch(`${API_BASE}/bets/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ amount }),
        });
        return res.json();
    },

    saveBankDetails: async (accountNumber, ifsc, accountHolder) => {
        const res = await fetch(`${API_BASE}/bets/save-bank`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ accountNumber, ifsc, accountHolder }),
        });
        return res.json();
    },

    getBetHistory: async () => {
        const res = await fetch(`${API_BASE}/bets/history`, {
            credentials: 'include',
        });
        return res.json();
    },

    getTransactions: async () => {
        const res = await fetch(`${API_BASE}/bets/transactions`, {
            credentials: 'include',
        });
        return res.json();
    },

    // Admin
    adminLogin: async (phone, password) => {
        const res = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ phone, password }),
        });
        return res.json();
    },

    setResult: async (result) => {
        const res = await fetch(`${API_BASE}/admin/set-result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ result }),
        });
        return res.json();
    },

    getUsers: async (search = '') => {
        const res = await fetch(`${API_BASE}/admin/users?search=${search}`, {
            credentials: 'include',
        });
        return res.json();
    },

    updateBalance: async (userId, amount) => {
        const res = await fetch(`${API_BASE}/admin/update-balance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ userId, amount }),
        });
        return res.json();
    },

    getRecharges: async () => {
        const res = await fetch(`${API_BASE}/admin/recharges`, {
            credentials: 'include',
        });
        return res.json();
    },

    approveRecharge: async (requestId, approve) => {
        const res = await fetch(`${API_BASE}/admin/approve-recharge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ requestId, approve }),
        });
        return res.json();
    },

    getWithdrawals: async () => {
        const res = await fetch(`${API_BASE}/admin/withdrawals`, {
            credentials: 'include',
        });
        return res.json();
    },

    approveWithdrawal: async (requestId, approve) => {
        const res = await fetch(`${API_BASE}/admin/approve-withdrawal`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ requestId, approve }),
        });
        return res.json();
    },

    getCurrentBets: async () => {
        const res = await fetch(`${API_BASE}/admin/bets`, {
            credentials: 'include',
        });
        return res.json();
    },

    updateUPI: async (upiId, qrImage) => {
        const res = await fetch(`${API_BASE}/admin/update-upi`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ upiId, qrImage }),
        });
        return res.json();
    },

    getUPI: async () => {
        const res = await fetch(`${API_BASE}/admin/upi`, {
            credentials: 'include',
        });
        return res.json();
    },

    getRoundBets: async (roundId) => {
        const res = await fetch(`${API_BASE}/bets/round-bets?roundId=${roundId}`, {
            credentials: 'include',
        });
        return res.json();
    },

    // Notifications
    getNotifications: async () => {
        const res = await fetch(`${API_BASE}/notifications`, {
            credentials: 'include',
        });
        return res.json();
    },

    dismissNotification: async (id) => {
        const res = await fetch(`${API_BASE}/notifications/dismiss/${id}`, {
            method: 'POST',
            credentials: 'include',
        });
        return res.json();
    },

    createNotification: async (message, targetUserPhone, durationMinutes) => {
        const res = await fetch(`${API_BASE}/admin/create-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ message, targetUserPhone, durationMinutes }),
        });
        return res.json();
    },

    getAdminNotifications: async () => {
        const res = await fetch(`${API_BASE}/admin/notifications`, {
            credentials: 'include',
        });
        return res.json();
    },

    updateNotification: async (notificationId, message, targetUserPhone, durationMinutes) => {
        const res = await fetch(`${API_BASE}/admin/update-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ notificationId, message, targetUserPhone, durationMinutes }),
        });
        return res.json();
    },

    deleteNotification: async (notificationId) => {
        const res = await fetch(`${API_BASE}/admin/delete-notification`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ notificationId }),
        });
        return res.json();
    },
};
