import type { AxiosInstance } from "axios";
import { err, ok, type Result } from "neverthrow";

export type GetTwitchUsersParams = {
    id?: string;
    login?: string;
}

export type GetTwitchUsersResponse = {
    data: {
        id: string;
        login: string;
        display_name: string;
        type: string;
        broadcaster_type: string;
        description: string;
        profile_image_url: string;
        offline_image_url: string;
        view_count: number;
        email: string;
        created_at: string;
    }
}

export async function getTwitchUsers(client: AxiosInstance, params: GetTwitchUsersParams): Promise<Result<GetTwitchUsersResponse, Error>> {
    try {
        const response = await client.get<GetTwitchUsersResponse>("/users", {
            params: {
                ...params,
            },
        });
        return ok(response.data);
    } catch (error) {
        const axiosError = error as Error;
        return err(axiosError);
    }
}
