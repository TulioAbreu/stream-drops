import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { STORAGE_KEY_LOGIN_STORAGE } from '.';

interface LoginStore {
    twitchAccessToken: string | null;
    driveCode: string | null;
    setDriveCode: (driveCode: string) => void;
    setTwitchAccessToken: (twitchAccessToken: string | null) => void;
    sessionExpired: boolean;
    setSessionExpired: (sessionExpired: boolean) => void;
}

export const useLoginStore = create(
    persist<LoginStore>(
        (set) => ({
            twitchAccessToken: null,
            setTwitchAccessToken: (twitchAccessToken: string | null) => set({ twitchAccessToken }),
            driveCode: null,
            setDriveCode: (driveCode: string) => set({ driveCode }),
            sessionExpired: false,
            setSessionExpired: (sessionExpired: boolean) => set({ sessionExpired }),
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
