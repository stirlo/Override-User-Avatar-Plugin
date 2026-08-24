import { findByProps, findByStoreName } from "@vendetta/metro";
import { FluxDispatcher } from "@vendetta/metro/common";
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

// Installs avatar overrides and refreshes each configured user in the UI.
export function onLoad(): void {
    console.log(`${TAG} loaded`);

    const UserStore = findByStoreName("UserStore");
    if (!UserStore) {
        console.log(`${TAG} userStore not found`);
        return;
    }

    const avatarModule = findByProps("getUserAvatarURL");
    if (!avatarModule) {
        console.log(`${TAG} avatar module not found`);
        return;
    }

    // Overrides avatar sources in DMs and group chats for configured users.
    if (avatarModule.getUserAvatarSource) {
        const originalGetUserAvatarSource = avatarModule.getUserAvatarSource;
        avatarModule.getUserAvatarSource = function (...args) {
            const user = args[0];
            const entry = user?.id ? getOverrides()[user.id] : undefined;
            const overrideUrl = entry ? resolveUrl(entry) : "";

            if (overrideUrl) {
                const original = originalGetUserAvatarSource.apply(this, args);
                if (original) {
                    return {
                        ...original,
                        uri: overrideUrl
                    };
                }
                return original;
            }

            return originalGetUserAvatarSource.apply(this, args);
        };

        // Restores the original DM and group chat avatar source function.
        patches.push(() => { avatarModule.getUserAvatarSource = originalGetUserAvatarSource; });
    }

    const originalGetUserAvatarURL = avatarModule.getUserAvatarURL;

    // Overrides avatar URLs in voice calls for configured users.
    avatarModule.getUserAvatarURL = function (...args) {
        const user = args[0];
        const entry = user?.id ? getOverrides()[user.id] : undefined;
        const overrideUrl = entry ? resolveUrl(entry) : "";

        if (overrideUrl) {
            return overrideUrl;
        }

        return originalGetUserAvatarURL.apply(this, args);
    };

    // Restores the original voice call avatar URL function.
    patches.push(() => { avatarModule.getUserAvatarURL = originalGetUserAvatarURL; });

    console.log(`${TAG} patches applied`);

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
