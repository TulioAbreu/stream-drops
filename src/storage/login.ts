import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY_LOGIN_STORAGE } from '.';

interface LoginStore {
    twitchAccessToken: string | null;
    setTwitchAccessToken: (twitchAccessToken: string) => void;
}

export const useLoginStore = create(
    persist<LoginStore>(
        (set) => ({
            twitchAccessToken: null,
            setTwitchAccessToken: (twitchAccessToken: string) => set({ twitchAccessToken }),
        }),
        {
            name: STORAGE_KEY_LOGIN_STORAGE,
            storage: {
                getItem: (name) => {
                    const value = localStorage.getItem(name);
                    return value ? JSON.parse(value) : null;
                },
                setItem: (name, value) => {
                    localStorage.setItem(name, JSON.stringify(value));
                },
                removeItem: (name) => {
                    localStorage.removeItem(name);
                },
            },
        }
    )
);
