import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../services/api';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials) => {
        set({ isLoading: true });
        try {
          const response = await authAPI.login(credentials);
          const { token, user } = response.data;

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });

          localStorage.setItem('token', token);
          return { success: true };
        } catch (error) {
          set({ isLoading: false });
          return {
            success: false,
            error: error.response?.data?.message || 'Помилка входу',
          };
        }
      },

      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        localStorage.removeItem('token');
      },

      fetchUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        try {
          const response = await authAPI.getMe();
          set({
            user: response.data,
            isAuthenticated: true,
          });
        } catch (error) {
          console.error('Failed to fetch user:', error);
          localStorage.removeItem('token');
        }
      },

      updateUser: (userData) => {
        set((state) => ({
          user: { ...state.user, ...userData },
        }));
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useAssetsStore = create((set, get) => ({
  assets: [],
  currentAsset: null,
  loading: false,
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },
  filters: {},

  setAssets: (assets) => set({ assets }),
  setCurrentAsset: (asset) => set({ currentAsset: asset }),
  setLoading: (loading) => set({ loading }),
  setPagination: (pagination) => set({ pagination }),
  setFilters: (filters) => set({ filters }),

  fetchAssets: async (params = {}) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/assets?${new URLSearchParams(params)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();

      set({
        assets: data.data,
        pagination: data.pagination,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch assets:', error);
    }
  },

  fetchAssetById: async (id) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/assets/${id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();

      set({
        currentAsset: data,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch asset:', error);
    }
  },
}));

export const useActsStore = create((set) => ({
  acts: [],
  currentAct: null,
  loading: false,
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },

  setActs: (acts) => set({ acts }),
  setCurrentAct: (act) => set({ currentAct: act }),
  setLoading: (loading) => set({ loading }),

  fetchActs: async (params = {}) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/acts?${new URLSearchParams(params)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();

      set({
        acts: data.data,
        pagination: data.pagination,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch acts:', error);
    }
  },
}));

export const useUsersStore = create((set) => ({
  users: [],
  loading: false,
  pagination: { page: 1, limit: 50, total: 0, totalPages: 0 },

  setUsers: (users) => set({ users }),
  setLoading: (loading) => set({ loading }),

  fetchUsers: async (params = {}) => {
    set({ loading: true });
    try {
      const response = await fetch(`/api/users?${new URLSearchParams(params)}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();

      set({
        users: data.data,
        pagination: data.pagination,
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      console.error('Failed to fetch users:', error);
    }
  },
}));
