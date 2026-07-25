export interface TwitchIdValidateTokenResponse {
    client_id: string;
    login: string;
    /** Campo oficial da Twitch */
    scopes?: string[];
    /** Alias usado por alguns mocks / docs antigas */
    scope?: string[];
    token_type: string;
    expires_in: number;
    user_id: string;
    user_name?: string;
}
