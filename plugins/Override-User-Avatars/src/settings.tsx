import { React, ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

const { FormDivider, FormInput, FormRow } = Forms;

type AvatarOverride = {
    primary: string;
    fallback?: string;
};

// Renders the form for adding overrides and the list of saved users.
export default function Settings() {
    useProxy(storage);

    const [userId, setUserId] = React.useState("");
    const [primaryUrl, setPrimaryUrl] = React.useState("");
    const [fallbackUrl, setFallbackUrl] = React.useState("");
    const overrides: Record<string, AvatarOverride> = storage.overrides ?? {};

    // Validates and stores a new override using a new object for reactivity.
    function addOverride(): void {
        const trimmedUserId = userId.trim();
        const trimmedPrimaryUrl = primaryUrl.trim();
        const trimmedFallbackUrl = fallbackUrl.trim();

        if (!trimmedUserId || !trimmedPrimaryUrl) {
            return;
        }

        storage.overrides = {
            ...overrides,
            [trimmedUserId]: {
                primary: trimmedPrimaryUrl,
                ...(trimmedFallbackUrl ? { fallback: trimmedFallbackUrl } : {})
            }
        };

        setUserId("");
        setPrimaryUrl("");
        setFallbackUrl("");
    }

    // Removes one override by rebuilding and reassigning the stored map.
    function removeOverride(id: string): void {
        const copy = { ...storage.overrides };
        delete copy[id];
        storage.overrides = copy;
    }

    // Renders one removable row for a saved user override.
    function renderOverride([id, entry]: [string, AvatarOverride]) {
        const subLabel = `${entry.primary}${entry.fallback ? " (fallback set)" : ""}`;

        return (
            <FormRow
                key={id}
                label={id}
                subLabel={subLabel}
                onPress={removeOverride.bind(null, id)}
            />
        );
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
            <FormRow label="Image URL" />
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
            <FormRow label="Add" onPress={addOverride} />
            <FormDivider />
            {Object.entries(overrides).map(renderOverride)}
        </ReactNative.ScrollView>
    );
}
