import type { BroadcasterSubscriber } from "../twitch/types";

interface CreateGiveawayResultSheets {
    participants: BroadcasterSubscriber[];
    winners: BroadcasterSubscriber[];
    requiredSubscriber: number;
    subscriberMultiplier: Record<string, number>;
    title: string;
    description: string;
}

declare const google: any;

function getDriveAccessToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        const driveClient = google.accounts.oauth2.initTokenClient({
            client_id: '790178845295-d80705l73fje56tomu29lnmlspl85lnt.apps.googleusercontent.com',
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

export async function exportGiveawayResultToSheets({
    participants,
    winners,
    requiredSubscriber,
    subscriberMultiplier,
    title,
    description,
}: CreateGiveawayResultSheets): Promise<string> {
    const driveAccessToken = await getDriveAccessToken();

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
        ...participants.map(p => [p.user_name, p.tier, String(subscriberMultiplier[p.tier] || 1)])
    ];

    const winnerValues = [
        ["Nome", "Tier", "Multiplicador"],
        ...winners.map(w => [w.user_name, w.tier, String(subscriberMultiplier[w.tier] || 1)])
    ];

    const detailsValues = [
        ["Título", title],
        ["Descrição", description],
        ["Inscritos Necessários", String(requiredSubscriber)],
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
