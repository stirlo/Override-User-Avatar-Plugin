import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
import { after } from "@vendetta/patcher";
import { storage } from "@vendetta/plugin";

type AvatarOverride = {
    primary: string;
    fallback?: string;
};

// Tag added to all print statements to help with debugging with logcat on adb.
const TAG = "[custom-avatars]";

let patches = [];

export { default as settings } from "./settings";

// Returns every configured avatar override, or an empty map before setup.
function getOverrides(): Record<string, AvatarOverride> {
    return storage.overrides ?? {};
}

// Selects the primary URL, falling back only when the primary field is empty.
function resolveUrl(entry: AvatarOverride): string {
    return entry.primary || entry.fallback || "";
}

// Extracts a user ID from Discord's guild-member avatar argument shapes.
function getGuildUserId(value: any): string {
    return value?.userId || value?.user?.id || value?.id || "";
}

// Installs avatar overrides and refreshes each configured user in the UI.
export function onLoad(): void {
    console.log(`${TAG} loaded`);

    const avatarModule = findByProps("getUserAvatarURL");
    if (!avatarModule) {
        console.log(`${TAG} avatar module not found`);
        return;
    }

    // Overrides completed avatar sources without replacing Discord's function.
    if (typeof avatarModule.getUserAvatarSource === "function") {
        patches.push(after("getUserAvatarSource", avatarModule, (args, original) => {
            const user = args[0];
            const entry = user?.id ? getOverrides()[user.id] : undefined;
            const overrideUrl = entry ? resolveUrl(entry) : "";

            if (overrideUrl && original) {
                return {
                    ...original,
                    uri: overrideUrl
                };
            }

            return original;
        }));
    }

    // Overrides completed avatar URLs without replacing Discord's function.
    if (typeof avatarModule.getUserAvatarURL === "function") {
        patches.push(after("getUserAvatarURL", avatarModule, (args, original) => {
            const user = args[0];
            const entry = user?.id ? getOverrides()[user.id] : undefined;
            const overrideUrl = entry ? resolveUrl(entry) : "";

            return overrideUrl || original;
        }));
    }

    // Overrides completed guild-member avatar sources used in server contexts.
    if (typeof avatarModule.getGuildMemberAvatarSource === "function") {
        patches.push(after("getGuildMemberAvatarSource", avatarModule, (args, original) => {
            const userId = getGuildUserId(args[0]);
            const entry = userId ? getOverrides()[userId] : undefined;
            const overrideUrl = entry ? resolveUrl(entry) : "";

            if (overrideUrl && original) {
                return {
                    ...original,
                    uri: overrideUrl
                };
            }

            return original;
        }));
    }

    // Overrides completed guild-member avatar URLs used outside image sources.
    if (typeof avatarModule.getGuildMemberAvatarURL === "function") {
        patches.push(after("getGuildMemberAvatarURL", avatarModule, (args, original) => {
            const userId = getGuildUserId(args[0]);
            const entry = userId ? getOverrides()[userId] : undefined;
            const overrideUrl = entry ? resolveUrl(entry) : "";

            return overrideUrl || original;
        }));
    }

    console.log(`${TAG} patches applied`);

    const UserStore = findByStoreName("UserStore");
    if (!UserStore) {
        console.log(`${TAG} userStore not found; skipping ui refresh`);
        return;
    }

    try {
        for (const userId of Object.keys(getOverrides())) {
            FluxDispatcher.dispatch({
                type: "USER_UPDATE",
                user: UserStore.getUser(userId)
            });
        }
        console.log(`${TAG} ui refreshed`);
    } catch (e) {
        console.log(`${TAG} could not trigger refresh:`, e.message);
    }
}

// Restores every patched avatar function when the plugin unloads.
export function onUnload(): void {
    console.log(`${TAG} unloading...`);

    for (const unpatch of patches) {
        unpatch();
    }
    patches = [];

    console.log(`${TAG} unloaded`);
}
