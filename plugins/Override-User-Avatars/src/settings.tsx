import { clipboard, React, ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

const { FormDivider, FormInput, FormRow } = Forms;

type AvatarOverride = {
    primary: string;
    fallback?: string;
};

type BackupPayload = {
    format: 1;
    exportedAt: string;
    overrides: Record<string, AvatarOverride>;
};

const MAX_IMAGE_BYTES = 750_000;
const MAX_BACKUP_CHARACTERS = 10_000_000;
const SUPPORTED_IMAGE_TYPES = new Set(["image/gif", "image/jpeg", "image/png", "image/webp"]);

// Converts a downloaded image blob into a local data URI for persistent storage.
function readBlobAsDataUri(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        // Resolves only when FileReader produced a complete data URI string.
        reader.onload = function handleLoad(): void {
            if (typeof reader.result === "string" && reader.result.startsWith("data:image/")) {
                resolve(reader.result);
                return;
            }
            reject(new Error("The downloaded file could not be encoded as an image."));
        };

        // Converts native FileReader failures into a useful settings message.
        reader.onerror = function handleError(): void {
            reject(new Error("Kettu could not read the downloaded image."));
        };

        reader.readAsDataURL(blob);
    });
}

// Downloads, validates, and converts one remote image for private on-device storage.
async function downloadImageAsDataUri(url: string): Promise<string> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Image download failed with HTTP ${response.status}.`);
    }

    const blob = await response.blob();
    const contentType = (blob.type || response.headers.get("content-type") || "")
        .split(";", 1)[0]
        .trim()
        .toLowerCase();

    if (!SUPPORTED_IMAGE_TYPES.has(contentType)) {
        throw new Error("Use a direct PNG, JPEG, WebP, or GIF image URL.");
    }
    if (blob.size === 0) {
        throw new Error("The downloaded image was empty.");
    }
    if (blob.size > MAX_IMAGE_BYTES) {
        throw new Error("The image must be smaller than 750 KB.");
    }

    return readBlobAsDataUri(blob);
}

// Produces a short message without exposing a private source URL.
function describeError(error: unknown): string {
    return error instanceof Error ? error.message : "The image could not be stored locally.";
}

// Serializes every override, including embedded images, into a versioned backup.
function createBackupJson(overrides: Record<string, AvatarOverride>): string {
    const backup: BackupPayload = {
        format: 1,
        exportedAt: new Date().toISOString(),
        overrides
    };

    return JSON.stringify(backup);
}

// Validates a clipboard backup before it is allowed to merge into plugin storage.
function parseBackupJson(value: string): Record<string, AvatarOverride> {
    if (!value || value.length > MAX_BACKUP_CHARACTERS) {
        throw new Error("The clipboard does not contain a supported backup size.");
    }

    let backup: Partial<BackupPayload>;
    try {
        backup = JSON.parse(value) as Partial<BackupPayload>;
    } catch {
        throw new Error("The clipboard does not contain valid backup JSON.");
    }
    if (backup.format !== 1 || !backup.overrides || Array.isArray(backup.overrides)) {
        throw new Error("The clipboard does not contain an Override User Avatars backup.");
    }

    const restored: Record<string, AvatarOverride> = {};
    for (const [id, entry] of Object.entries(backup.overrides)) {
        if (!id.trim() || !entry || typeof entry.primary !== "string" || !entry.primary) {
            throw new Error("The backup contains an invalid avatar entry.");
        }
        if (entry.fallback !== undefined && typeof entry.fallback !== "string") {
            throw new Error("The backup contains an invalid fallback image.");
        }

        restored[id] = {
            primary: entry.primary,
            ...(entry.fallback ? { fallback: entry.fallback } : {})
        };
    }

    if (Object.keys(restored).length === 0) {
        throw new Error("The backup does not contain any avatar entries.");
    }

    return restored;
}

// Renders the form for adding overrides and the list of saved users.
export default function Settings() {
    useProxy(storage);

    const [userId, setUserId] = React.useState("");
    const [primaryUrl, setPrimaryUrl] = React.useState("");
    const [fallbackUrl, setFallbackUrl] = React.useState("");
    const [importStatus, setImportStatus] = React.useState("");
    const [isImporting, setIsImporting] = React.useState(false);
    const [backupStatus, setBackupStatus] = React.useState("");
    const overrides: Record<string, AvatarOverride> = storage.overrides ?? {};

    // Downloads and stores a new override locally using a new object for reactivity.
    async function addOverride(): Promise<void> {
        const trimmedUserId = userId.trim();
        const trimmedPrimaryUrl = primaryUrl.trim();
        const trimmedFallbackUrl = fallbackUrl.trim();

        if (!trimmedUserId || !trimmedPrimaryUrl) {
            setImportStatus("User ID and primary image URL are required.");
            return;
        }

        setIsImporting(true);
        setImportStatus("Downloading primary image...");

        try {
            const localPrimary = await downloadImageAsDataUri(trimmedPrimaryUrl);
            let localFallback: string | undefined;

            if (trimmedFallbackUrl) {
                setImportStatus("Downloading fallback image...");
                localFallback = await downloadImageAsDataUri(trimmedFallbackUrl);
            }

            storage.overrides = {
                ...(storage.overrides ?? {}),
                [trimmedUserId]: {
                    primary: localPrimary,
                    ...(localFallback ? { fallback: localFallback } : {})
                }
            };

            setUserId("");
            setPrimaryUrl("");
            setFallbackUrl("");
            setImportStatus("Stored locally. The source URL was not retained.");
        } catch (error) {
            setImportStatus(describeError(error));
        } finally {
            setIsImporting(false);
        }
    }

    // Removes one override by rebuilding and reassigning the stored map.
    function removeOverride(id: string): void {
        const copy = { ...storage.overrides };
        delete copy[id];
        storage.overrides = copy;
    }

    // Renders one removable row for a saved user override.
    function renderOverride([id, entry]: [string, AvatarOverride]) {
        const storageKind = entry.primary.startsWith("data:image/") ? "Stored locally" : "Remote image";
        const subLabel = `${storageKind}${entry.fallback ? " (fallback set)" : ""}`;

        return (
            <FormRow
                key={id}
                label={id}
                subLabel={subLabel}
                onPress={removeOverride.bind(null, id)}
            />
        );
    }

    // Copies a complete versioned backup into the system clipboard.
    function copyBackup(): void {
        if (Object.keys(overrides).length === 0) {
            setBackupStatus("There are no avatar entries to back up.");
            return;
        }

        clipboard.setString(createBackupJson(overrides));
        setBackupStatus("Backup copied. It includes the embedded images.");
    }

    // Restores validated avatar entries from the current system clipboard.
    async function restoreBackup(): Promise<void> {
        try {
            const restored = parseBackupJson(await clipboard.getString());
            storage.overrides = {
                ...(storage.overrides ?? {}),
                ...restored
            };
            setBackupStatus(`Restored ${Object.keys(restored).length} avatar entr${Object.keys(restored).length === 1 ? "y" : "ies"}.`);
        } catch (error) {
            setBackupStatus(describeError(error));
        }
    }

    return (
        <ReactNative.ScrollView>
            <FormRow label="User ID" />
            <FormInput
                placeholder="Enter user ID"
                value={userId}
                onChange={setUserId}
            />
            <FormDivider />
            <FormRow label="Image URL" subLabel="Downloaded once and stored on this device" />
            <FormInput
                placeholder="Enter primary image URL"
                value={primaryUrl}
                onChange={setPrimaryUrl}
            />
            <FormDivider />
            <FormRow label="Fallback URL (optional)" />
            <FormInput
                placeholder="Enter fallback image URL"
                value={fallbackUrl}
                onChange={setFallbackUrl}
            />
            <FormRow
                label={isImporting ? "Importing..." : "Add and store locally"}
                subLabel={importStatus}
                onPress={isImporting ? undefined : addOverride}
            />
            <FormDivider />
            {Object.entries(overrides).map(renderOverride)}
            <FormDivider />
            <FormRow
                label="Copy backup JSON"
                subLabel="Includes images; the system clipboard may sync to other devices"
                onPress={copyBackup}
            />
            <FormRow
                label="Restore backup from clipboard"
                subLabel={backupStatus}
                onPress={restoreBackup}
            />
        </ReactNative.ScrollView>
    );
}
