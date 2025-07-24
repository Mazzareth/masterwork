import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase-admin';

const LANE_TO_ROLE_ID: { [key: string]: string | undefined } = {
    top: process.env.ROLE_ID_TOP,
    jungle: process.env.ROLE_ID_JUNGLE,
    mid: process.env.ROLE_ID_MID,
    adc: process.env.ROLE_ID_ADC,
    support: process.env.ROLE_ID_SUPPORT,
};

/**
 * Updates a user's roles in Discord based on their selected lanes.
 * It fetches the member's current roles, removes all managed lane roles,
 * and then adds the new ones.
 * @param {string} discordId - The user's Discord ID.
 * @param {string[]} newLanes - An array of lane keys to assign (e.g., ['jungle', 'top']).
 * @throws Will throw an error if the Discord API requests fail.
 */
async function updateDiscordMemberRoles(discordId: string, newLanes: string[]) {
    const GUILD_ID = process.env.DISCORD_GUILD_ID;
    const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
    const API_BASE = 'https://discord.com/api/v10';

    if (!GUILD_ID || !BOT_TOKEN) {
        throw new Error('Discord environment variables are not configured.');
    }

    const memberUrl = `${API_BASE}/guilds/${GUILD_ID}/members/${discordId}`;
    const headers = {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
    };

    const memberResponse = await fetch(memberUrl, { headers });
    if (!memberResponse.ok) {
        const errorText = await memberResponse.text();
        throw new Error(`Failed to fetch Discord member: ${errorText}`);
    }
    const member = await memberResponse.json();
    const currentRoles: string[] = member.roles;

    const allManagedRoleIds = Object.values(LANE_TO_ROLE_ID).filter(Boolean) as string[];
    const rolesWithoutLanes = currentRoles.filter(roleId => !allManagedRoleIds.includes(roleId));
    const newRoleIdsToAdd = newLanes.map(lane => LANE_TO_ROLE_ID[lane]).filter(Boolean) as string[];
    const finalRoles = [...new Set([...rolesWithoutLanes, ...newRoleIdsToAdd])];

    const updateResponse = await fetch(memberUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ roles: finalRoles }),
    });

    if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Failed to update Discord roles: ${errorText}`);
    }
}

/**
 * @route POST /api/profile
 * @description
 * Handles the saving of a user's profile and triggers side effects, such as
 * updating their roles in Discord. This is the single, unified endpoint for profile updates.
 * @param {Request} req The incoming Next.js request object.
 * @property {object} req.headers - Must contain the `Authorization` header.
 * @property {string} req.headers.Authorization - The "Bearer <Firebase ID Token>" credential.
 * @property {object} req.body - The JSON body of the request.
 * @property {string[]} req.body.lanes - An array of lane keys (e.g., ['jungle', 'top'])
 *   that correspond to the Discord roles to be assigned.
 * @property {string} [req.body.displayName] - The user's updated display name.
 * @property {string} [req.body.bio] - The user's updated bio.
 *
 * @returns {Promise<NextResponse>} A JSON response with a success message on a
 *   successful update, or an appropriate error response on failure.
 */
export async function POST(req: Request) {
    try {
        // 1. Authenticate the user
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await auth.verifyIdToken(token);
        const { uid } = decodedToken;

        // 2. Parse request body
        const body: {
            displayName?: string;
            bio?: string;
            leagueIGN?: string;
            hashtag?: string;
            primaryRole?: string;
            secondaryRole?: string;
        } = await req.json();
        const { displayName, bio, leagueIGN, hashtag, primaryRole, secondaryRole } = body;

        // 3. Save to Firestore
        const userDocRef = db.collection('users').doc(uid);
        const userDoc = await userDocRef.get();

        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found.' }, { status: 404 });
        }

        const profileData: {
            displayName?: string;
            bio?: string;
            leagueIGN?: string;
            hashtag?: string;
            primaryRole?: string;
            secondaryRole?: string;
        } = {};
        // Use `hasOwnProperty` to allow setting fields to null or empty strings
        if (body.hasOwnProperty('displayName')) {
            profileData.displayName = displayName;
        }
        if (body.hasOwnProperty('bio')) {
            profileData.bio = bio;
        }
        if (body.hasOwnProperty('leagueIGN')) {
            profileData.leagueIGN = leagueIGN;
        }
        if (body.hasOwnProperty('hashtag')) {
            profileData.hashtag = hashtag;
        }
        if (body.hasOwnProperty('primaryRole')) {
            profileData.primaryRole = primaryRole;
        }
        if (body.hasOwnProperty('secondaryRole')) {
            profileData.secondaryRole = secondaryRole;
        }

        if (Object.keys(profileData).length > 0) {
            await userDocRef.set(profileData, { merge: true });
        }

        // 4. Handle Discord role update side-effect
        const discordId = userDoc.data()?.discordProfile?.id;

        const rolesToUpdate = [primaryRole, secondaryRole]
            .filter((role): role is string => typeof role === 'string' && role.length > 0)
            .map(role => role.toLowerCase());

        if (discordId && rolesToUpdate.length > 0) {
            try {
                await updateDiscordMemberRoles(discordId, rolesToUpdate);
            } catch (error) {
                // Log the error but don't fail the entire request, as the primary
                // profile update to Firestore was successful.
                console.error(`Discord role update failed for user ${uid} (Discord ID: ${discordId}):`, error);
            }
        }

        // 5. Return success
        return NextResponse.json({
            success: true,
            message: 'Profile updated successfully.',
        });
    } catch (error) {
        console.error('Profile update error:', error);

        if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            typeof (error as { code: unknown }).code === 'string' &&
            (error as { code: string }).code.startsWith('auth/')
        ) {
            return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 });
        }

        return NextResponse.json(
            { error: 'An internal server error occurred.' },
            { status: 500 },
        );
    }
}