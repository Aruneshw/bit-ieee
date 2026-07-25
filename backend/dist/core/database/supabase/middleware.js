"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSession = updateSession;
const ssr_1 = require("@supabase/ssr");
const server_1 = require("next/server");
async function updateSession(request) {
    let supabaseResponse = server_1.NextResponse.next({ request });
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseKey) {
            throw new Error('Missing Supabase environment variables in Edge runtime.');
        }
        const supabase = (0, ssr_1.createServerClient)(supabaseUrl, supabaseKey, {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    supabaseResponse = server_1.NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
                },
            },
        });
        const path = request.nextUrl.pathname;
        // Public routes that should not ask Supabase for a session.
        if (path === '/' || path.startsWith('/auth/')) {
            return supabaseResponse;
        }
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error && error.message !== 'Auth session missing!') {
            console.error('Supabase middleware auth error:', error.message);
        }
        // Not logged in → redirect to login (unless public)
        if (!user && path !== '/login') {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return server_1.NextResponse.redirect(url);
        }
        // Logged in + on /login → redirect to dashboard (which will route them)
        if (user && path === '/login') {
            const url = request.nextUrl.clone();
            url.pathname = '/dashboard';
            return server_1.NextResponse.redirect(url);
        }
        return supabaseResponse;
    }
    catch (error) {
        // Prevent crashes: if anything throws (e.g. env vars missing), just proceed
        console.error('Middleware crash prevented:', error);
        return supabaseResponse;
    }
}
