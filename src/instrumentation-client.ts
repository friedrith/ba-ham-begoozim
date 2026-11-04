import posthog from 'posthog-js'

const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN

// Without a token, as in local dev and forks, PostHog never loads and nothing is sent.
if (token) {
  posthog.init(token, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2026-08-30',
    // The game has no cookie banner, so it stores nothing on the player's device.
    cookieless_mode: 'always',
    // Every press of a bean pad is a click, which would drown out the game events.
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    // Analytics only: the other PostHog products stay off and can't be enabled remotely.
    advanced_disable_flags: true,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    capture_exceptions: false,
    capture_performance: false,
  })
}
