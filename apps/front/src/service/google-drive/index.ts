import type { BroadcasterSubscriber, TwitchSubscriptionTier } from "../twitch/types";

interface CreateGiveawayResultSheets {
    participants: BroadcasterSubscriber[];
    winners: BroadcasterSubscriber[];
    requiredSubscriber: number;
    subscriberMultiplier: Record<string, number>;
    title: string;
    description: string;
    driveAccessToken?: string;
}

type OverrideGiveawayResultSheets = CreateGiveawayResultSheets & {
    spreadsheetId: string;
};

declare const google: any;

function getDriveAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        const clientId = String(
            import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "",
        ).replace(/^["']|["']$/g, "");
        if (!clientId) {
            reject(
                new Error(
                    "VITE_GOOGLE_CLIENT_ID ausente. Configure em apps/front/.env",
                ),
            );
            return;
        }
        const driveClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets',
            callback: (tokenResponse: any) => {
                const accessToken = tokenResponse.access_token;
                if (accessToken) {
                    resolve(accessToken);
                } else {
                    reject(new Error("Erro ao obter o token de acesso do Google Drive"));
                }
            }
        });
        driveClient.requestAccessToken();
    });
}

const tierMapper: Record<TwitchSubscriptionTier, string> = {
    "1000": "Tier 1",
    "2000": "Tier 2",
    "3000": "Tier 3"
};

export async function exportGiveawayResultToSheets({
    participants,
    winners,
    requiredSubscriber,
    subscriberMultiplier,
    title,
    description,
    driveAccessToken,
}: CreateGiveawayResultSheets): Promise<string> {
    if (!driveAccessToken) {
        driveAccessToken = await getDriveAccessToken();
    }

    // 1. Criar uma nova planilha no Google Drive
    const createFileRes = await fetch("https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            name: `Resultado do Sorteio - ${title}`,
            mimeType: "application/vnd.google-apps.spreadsheet"
        })
    });

    const createdFile = await createFileRes.json();
    const spreadsheetId = createdFile.id;
    if (!spreadsheetId) throw new Error("Erro ao criar a planilha no Drive");

    const sheetsBatchUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;

    await fetch(sheetsBatchUpdateUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            requests: [
                // Renomeia a aba padrão para "Ganhadores"
                { updateSheetProperties: { properties: { sheetId: 0, title: "Ganhadores" }, fields: "title" } },
                // Adiciona as outras abas
                { addSheet: { properties: { title: "Participantes" } } },
                { addSheet: { properties: { title: "Detalhes" } } }
            ]
        })
    });

    const participantValues = [
        ["Nome", "Tier", "Multiplicador"],
        ...participants.map(p => [p.user_name, tierMapper[p.tier], String(subscriberMultiplier[p.tier] || 1)])
    ];

    const winnerValues = [
        ["Nome", "Tier", "Multiplicador"],
        ...winners.map(w => [w.user_name, tierMapper[w.tier], String(subscriberMultiplier[w.tier] || 1)])
    ];

    const detailsValues = [
        ["Título", title],
        ["Descrição", description],
        ["Critério de Participação", `Tier ${Number(requiredSubscriber) / 1000}`],
        ["Ganhadores", String(winners.length)],
        ["Multiplicadores de Sub"],
        ["Tier 1", String(subscriberMultiplier["1000"] || 1)],
        ["Tier 2", String(subscriberMultiplier["2000"] || 1)],
        ["Tier 3", String(subscriberMultiplier["3000"] || 1)],
    ];

    const valuesUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    await fetch(valuesUpdateUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            valueInputOption: "RAW",
            data: [
                { range: "Ganhadores!A1", values: winnerValues },
                { range: "Participantes!A1", values: participantValues },
                { range: "Detalhes!A1", values: detailsValues }
            ]
        })
    });

    await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            role: "reader",
            type: "anyone"
        })
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

export async function overrideGiveawayResultToSheets({
    participants,
    winners,
    requiredSubscriber,
    subscriberMultiplier,
    title,
    description,
    spreadsheetId,
    driveAccessToken,
}: OverrideGiveawayResultSheets): Promise<string> {
    if (!driveAccessToken) {
        driveAccessToken = await getDriveAccessToken();
    }

    // 1. Busca todos os sheetIds da planilha
    const spreadsheetRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`,
        {
            headers: {
                Authorization: `Bearer ${driveAccessToken}`,
            },
        }
    );
    const spreadsheetData = await spreadsheetRes.json();
    const sheets = spreadsheetData.sheets as Array<{ properties: { sheetId: number; title: string } }>;

    // 2. Remove todas as abas (exceto a primeira, pois o Google exige pelo menos uma)
    const deleteRequests = sheets.slice(1).map(s => ({
        deleteSheet: { sheetId: s.properties.sheetId }
    }));

    if (deleteRequests.length > 0) {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${driveAccessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ requests: deleteRequests })
        });
    }

    // 3. Limpa o conteúdo da aba restante (sheetId 0)
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            requests: [
                {
                    updateCells: {
                        range: { sheetId: sheets[0].properties.sheetId },
                        fields: "userEnteredValue"
                    }
                }
            ]
        })
    });

    // 4. Renomeia a aba padrão para "Ganhadores" e cria as outras abas
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            requests: [
                { updateSheetProperties: { properties: { sheetId: sheets[0].properties.sheetId, title: "Ganhadores" }, fields: "title" } },
                { addSheet: { properties: { title: "Participantes" } } },
                { addSheet: { properties: { title: "Detalhes" } } }
            ]
        })
    });

    // 5. Prepara os dados
    const participantValues = [
        ["Nome", "Tier", "Multiplicador"],
        ...participants.map(p => [p.user_name, tierMapper[p.tier], String(subscriberMultiplier[p.tier] || 1)])
    ];

    const winnerValues = [
        ["Nome", "Tier", "Multiplicador"],
        ...winners.map(w => [w.user_name, tierMapper[w.tier], String(subscriberMultiplier[w.tier] || 1)])
    ];

    const detailsValues = [
        ["Título", title],
        ["Descrição", description],
        ["Critério de Participação", `Tier ${Number(requiredSubscriber) / 1000}`],
        ["Ganhadores", String(winners.length)],
        ["Multiplicadores de Sub"],
        ["Tier 1", String(subscriberMultiplier["1000"] || 1)],
        ["Tier 2", String(subscriberMultiplier["2000"] || 1)],
        ["Tier 3", String(subscriberMultiplier["3000"] || 1)],
    ];

    // 6. Escreve os dados nas abas
    const valuesUpdateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`;
    await fetch(valuesUpdateUrl, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            valueInputOption: "RAW",
            data: [
                { range: "Ganhadores!A1", values: winnerValues },
                { range: "Participantes!A1", values: participantValues },
                { range: "Detalhes!A1", values: detailsValues }
            ]
        })
    });

    // 7. Permissão pública
    await fetch(`https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${driveAccessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            role: "reader",
            type: "anyone"
        })
    });

    return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}
