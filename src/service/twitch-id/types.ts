export interface TwitchIdValidateTokenResponse {
    client_id: string;
    login: string;
    scope: string[];
    token_type: string;
    expires_in: number;
    user_id: string;
    user_name: string;
}
