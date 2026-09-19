document.addEventListener('DOMContentLoaded', () => {
    // --- PŁYNNA I WOLNIEJSZA ANIMACJA IKONY (bmw.gif) ORAZ TYTUŁU ---
    const titleText = "@rapldez";
    let titleIndex = 0;
    let isDeleting = false;

    let favicon = document.querySelector("link[rel*='icon']") || document.createElement('link');
    favicon.type = 'image/gif';
    favicon.rel = 'icon';
    favicon.href = 'bmw.gif';
    document.head.appendChild(favicon);

    function animateTitle() {
        if (!isDeleting) {
            titleIndex++;
            document.title = titleText.substring(0, titleIndex);
            if (titleIndex === titleText.length) {
                setTimeout(() => { isDeleting = true; animateTitle(); }, 2500); // dłuższa pauza po wpisaniu całości
                return;
            }
        } else {
            titleIndex--;
            document.title = titleText.substring(0, titleIndex) || "\u200B";
            if (titleIndex === 0) {
                setTimeout(() => { isDeleting = false; animateTitle(); }, 1000); // dłuższa pauza po wyczyszczeniu
                return;
            }
        }
        // Zwiększone opóźnienia, żeby tekst pisał się i kasował miękko, bez pośpiechu
        setTimeout(animateTitle, isDeleting ? 440 : 540);
    }
    animateTitle();

    const enterScreen = document.getElementById('enter-screen');
    const mainContent = document.getElementById('main-content');
    const bgAudio = document.getElementById('bg-audio');
    const bgVideo = document.getElementById('bg-video');
    const typewriterElement = document.getElementById('typewriter-text');
    const cursorTrail = document.getElementById('cursor-trail');
    
    const volumeSlider = document.getElementById('music-volume');
    const muteIcon = document.getElementById('music-mute-btn');
    const liveCounter = document.getElementById('live-counter');
    const liveClock = document.getElementById('live-clock');
    const card = document.querySelector('.card');

    const discordId = "920029957739139083";
    const statusDot = document.getElementById('status-dot');
    const discordStatusText = document.getElementById('discord-status');
    const discordAvatar = document.getElementById('discord-avatar');
    const badgesContainer = document.getElementById('badges-container');

    const playPauseBtn = document.getElementById('play-pause-btn');
    const prevTrackBtn = document.getElementById('prev-track-btn');
    const nextTrackBtn = document.getElementById('next-track-btn');
    const trackProgress = document.getElementById('track-progress');
    const currTimeDisp = document.getElementById('current-time');
    const totalTimeDisp = document.getElementById('total-time');

    let baseStatusHtml = 'Offline';
    let activeActivityStart = null;

    let audioCtx, analyser, source, dataArray, canvasCtx;
    const visualizerCanvas = document.getElementById('audio-visualizer');

    function initVisualizer() {
        if (audioCtx || !visualizerCanvas || !bgAudio) return;
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        source = audioCtx.createMediaElementSource(bgAudio);
        source.connect(analyser);
        analyser.connect(audioCtx.destination);
        analyser.fftSize = 64;
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        canvasCtx = visualizerCanvas.getContext('2d');

        function drawVisualizer() {
            requestAnimationFrame(drawVisualizer);
            analyser.getByteFrequencyData(dataArray);
            canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
            const barWidth = (visualizerCanvas.width / bufferLength) * 2;
            let barHeight, x = 0;
            for(let i = 0; i < bufferLength; i++) {
                barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
                canvasCtx.fillStyle = '#23a559';
                canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        }
        drawVisualizer();
    }

    function fetchWeather() {
        fetch('https://api.open-meteo.com/v1/forecast?latitude=53.4289&longitude=14.553&current_weather=true')
        .then(res => res.json())
        .then(data => {
            const temp = Math.round(data.current_weather.temperature);
            const weatherCode = data.current_weather.weathercode;
            let icon = 'fa-cloud';
            if(weatherCode === 0) icon = 'fa-sun';
            else if(weatherCode <= 3) icon = 'fa-cloud-sun';
            else if(weatherCode <= 67) icon = 'fa-cloud-rain';
            else if(weatherCode <= 77) icon = 'fa-snowflake';
            else if(weatherCode >= 95) icon = 'fa-bolt';
            const weatherWidget = document.getElementById('weather-szczecin');
            if(weatherWidget) weatherWidget.innerHTML = `<i class="fa-solid ${icon}"></i> ${temp}°C`;
        }).catch(err => {});
    }
    fetchWeather();

    function showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        container.innerHTML = '';

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        let icon = type === 'success' ? '<i class="fa-solid fa-check-circle"></i>' : '<i class="fa-solid fa-circle-exclamation"></i>';
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 400);
        }, 4000);
    }

    // SPRAWDZANIE SESJI OAUTH2
    let isAdminLogged = false;
    function checkAuthStatus() {
        fetch('/api/check-auth')
        .then(res => res.json())
        .then(data => {
            const statusText = document.getElementById('auth-status-text');
            const actionContainer = document.getElementById('auth-action-container');
            const embedBtn = document.getElementById('open-embed-btn');
            
            if (data.authenticated) {
                isAdminLogged = true;
                if (statusText) statusText.innerHTML = `<span style="color:#23a559;">Zalogowano: ${data.username}</span>`;
                if (actionContainer) actionContainer.innerHTML = `<button id="logout-btn" style="background:#f23f42; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">Wyloguj</button>`;
                if (embedBtn) embedBtn.style.display = 'inline-flex';
                
                document.getElementById('logout-btn')?.addEventListener('click', () => {
                    fetch('/api/logout', { method: 'POST' }).then(() => {
                        window.location.href = '/';
                    });
                });
                showToast("Autoryzacja pomyślna!", "success");
            } else {
                isAdminLogged = false;
                if (statusText) statusText.innerText = "Tryb gościa";
                if (actionContainer) actionContainer.innerHTML = `<a href="/auth/discord" class="admin-btn">Admin</a>`;
                if (embedBtn) embedBtn.style.display = 'none';
            }
        }).catch(err => {});
    }
    checkAuthStatus();

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('login') === 'success') {
        showToast("Zalogowano pomyślnie!", "success");
        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('error')) {
        showToast("Błąd logowania!", "error");
        window.history.replaceState({}, document.title, window.location.pathname);
    }

    const BADGES = {
        NITRO: "https://raw.githubusercontent.com/abrahamtdasilva/awbadges/main/src/badges/nitro.svg",
        HYPE_BRAVERY: "https://raw.githubusercontent.com/abrahamtdasilva/awbadges/main/src/badges/hypesquad_bravery.svg",
        HYPE_BRILLIANCE: "https://raw.githubusercontent.com/abrahamtdasilva/awbadges/main/src/badges/hypesquad_brilliance.svg",
        HYPE_BALANCE: "https://raw.githubusercontent.com/abrahamtdasilva/awbadges/main/src/badges/hypesquad_balance.svg",
        ACTIVE_DEV: "https://raw.githubusercontent.com/abrahamtdasilva/awbadges/main/src/badges/active_developer.svg",
        EARLY_SUPPORTER: "https://raw.githubusercontent.com/abrahamtdasilva/awbadges/main/src/badges/early_supporter.svg"
    };

    if (discordId !== "") {
        try {
            const socket = new WebSocket('wss://api.lanyard.rest/socket');
            socket.addEventListener('message', (event) => {
                const data = JSON.parse(event.data);
                if (data.op === 1) { 
                    socket.send(JSON.stringify({ op: 2, d: { subscribe_to_id: discordId } }));
                } else if (data.op === 0) { 
                    const p = data.t === 'INIT_STATE' || data.t === 'PRESENCE_UPDATE' ? data.d : null;
                    if (p) {
                        if (statusDot) statusDot.className = 'status-dot ' + p.discord_status;
                        activeActivityStart = null;
                        if (p.spotify) {
                            baseStatusHtml = `<i class="fa-brands fa-spotify" style="color:#1DB954; margin-right:4px;"></i>${p.spotify.artist.split(';')[0]} - ${p.spotify.song}`;
                            if (p.spotify.timestamps) activeActivityStart = p.spotify.timestamps.start;
                        } else if (p.activities && p.activities.length > 0) {
                            const game = p.activities.find(x => x.type === 0);
                            if (game) {
                                baseStatusHtml = `<i class="fa-solid fa-gamepad" style="color:#a0a0a0; margin-right:4px;"></i>Gra w: ${game.name}`;
                                if (game.timestamps) activeActivityStart = game.timestamps.start;
                            }
                        } else {
                            baseStatusHtml = p.discord_status === 'online' ? 'Online' : (p.discord_status === 'idle' ? 'Zaraz wracam' : 'Offline');
                        }
                        updateStatusDisplay();

                        if (p.discord_user && discordAvatar) {
                            const isAnimated = p.discord_user.avatar && p.discord_user.avatar.startsWith('a_');
                            if(p.discord_user.avatar) {
                                discordAvatar.src = `https://cdn.discordapp.com/avatars/${p.discord_user.id}/${p.discord_user.avatar}.${isAnimated?'gif':'png'}?size=512`;
                            }
                            if (badgesContainer && p.t === 'INIT_STATE') {
                                badgesContainer.innerHTML = '';
                                const flags = p.discord_user.public_flags;
                                let badgeHtml = '';
                                if (isAnimated) badgeHtml += `<img src="${BADGES.NITRO}" class="badge-icon">`;
                                if (flags & 64) badgeHtml += `<img src="${BADGES.HYPE_BRAVERY}" class="badge-icon">`;
                                if (flags & 128) badgeHtml += `<img src="${BADGES.HYPE_BRILLIANCE}" class="badge-icon">`;
                                if (flags & 4194304) badgeHtml += `<img src="${BADGES.ACTIVE_DEV}" class="badge-icon">`;
                                badgesContainer.innerHTML = badgeHtml;
                            }
                        }
                    }
                }
            });
        } catch(e) {}
    }

    function updateStatusDisplay() {
        if (!discordStatusText) return;
        if (activeActivityStart) {
            let diff = Math.floor((Date.now() - activeActivityStart) / 1000);
            let h = Math.floor(diff / 3600), m = Math.floor((diff % 3600) / 60);
            discordStatusText.innerHTML = `${baseStatusHtml} (od ${h > 0 ? h+'h ' : ''}${m}m)`;
        } else {
            discordStatusText.innerHTML = baseStatusHtml;
        }
    }

    fetch(`https://discord.com/api/v9/invites/cyvKv8YvU7?with_counts=true`)
        .then(res => res.json())
        .then(data => {
            if (data && data.guild) {
                const sName = document.getElementById('discord-server-name');
                const sStats = document.getElementById('discord-server-stats');
                const sIcon = document.getElementById('discord-server-icon');
                if(sName) sName.innerText = data.guild.name;
                if(sStats) sStats.innerHTML = `<span class="stats-dot"></span> ${data.approximate_presence_count} Online`;
                if (data.guild.icon && sIcon) sIcon.src = `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png`;
            }
        }).catch(err => {});

    let index = 0;
    const textToType = "always online...";
    function typeWriterTitle() {
        if (typewriterElement && index < textToType.length) {
            typewriterElement.innerHTML += textToType.charAt(index);
            index++;
            setTimeout(typeWriterTitle, 100);
        }
    }

    function typeAboutMe() {
        const lines = document.querySelectorAll('.type-line');
        const skillsBlock = document.querySelector('.skills-container');
        let currentLine = 0;
        function typeNextLine() {
            if (currentLine < lines.length) {
                const p = lines[currentLine], span = p.querySelector('span'), fullText = p.getAttribute('data-text');
                span.style.visibility = 'visible'; span.innerHTML = '';
                let charIndex = 0;
                function typeChar() {
                    if (charIndex < fullText.length) {
                        span.innerHTML += fullText.charAt(charIndex);
                        charIndex++;
                        setTimeout(typeChar, 10);
                    } else {
                        if (currentLine === 1 && skillsBlock) skillsBlock.style.opacity = "1";
                        currentLine++;
                        setTimeout(typeNextLine, 200);
                    }
                }
                typeChar();
            }
        }
        typeNextLine();
    }

    setInterval(() => {
        if(liveClock) liveClock.innerText = new Date().toLocaleTimeString('pl-PL');
        updateStatusDisplay();
    }, 1000);

    if (enterScreen) {
        enterScreen.addEventListener('click', () => {
            enterScreen.style.opacity = '0';
            setTimeout(() => enterScreen.style.display = 'none', 500);
            if (mainContent) { mainContent.style.opacity = '1'; mainContent.style.pointerEvents = 'auto'; }
            if (bgAudio) { bgAudio.volume = volumeSlider ? volumeSlider.value : 0.15; bgAudio.play().catch(e=>{}); }
            if (bgVideo) { bgVideo.muted = true; bgVideo.play().catch(e=>{}); }
            initVisualizer();
            setTimeout(() => { typeWriterTitle(); typeAboutMe(); }, 500);
        });
    }

    const openTermBtn = document.getElementById('open-terminal');
    const closeTermBtn = document.getElementById('close-terminal');
    const termOverlay = document.getElementById('terminal-overlay');
    const termInput = document.getElementById('terminal-input');
    const termOutput = document.getElementById('terminal-output');
    const mainTerminal = document.getElementById('main-terminal');
    const termForm = document.getElementById('terminal-form');

    function openTerminalClean(isManual) {
        termOverlay.style.opacity = '1';
        termOverlay.style.pointerEvents = 'auto';
        termOutput.innerHTML = ''; 
        if (isManual) {
            termOutput.innerHTML = `
                <div>[ rapldez OS v1.0 ]</div>
                <div style="color: #23a559;">Nawiązano autoryzowane połączenie.</div>
                <div>Wpisz 'pomoc', aby wyświetlić listę dostępnych poleceń.</div>
            `;
            if (isAdminLogged) {
                termOutput.innerHTML += `<div style="color: #fbc02d;">Zweryfikowano tożsamość root (OAuth2). Pełny dostęp.</div>`;
            }
        }
        setTimeout(() => termInput.focus(), 100);
    }

    if(openTermBtn && termOverlay) {
        openTermBtn.addEventListener('click', () => openTerminalClean(true));
        closeTermBtn.addEventListener('click', () => {
            termOverlay.style.opacity = '0';
            termOverlay.style.pointerEvents = 'none';
        });

        if (termForm) {
            termForm.addEventListener('submit', function(e) {
                e.preventDefault(); 
                const command = termInput.value.trim().toLowerCase();
                termInput.value = '';
                if (command === '') return;

                const cmdEcho = document.createElement('div');
                cmdEcho.innerHTML = `<span class="prompt">root@rapldez:</span> <span style="color:white;">${command}</span>`;
                termOutput.appendChild(cmdEcho);

                const response = document.createElement('div');
                switch(command) {
                    case 'pomoc':
                        let helpText = `
                            Dostępne polecenia:<br>
                            &nbsp;&nbsp;<b>setup</b>&nbsp;&nbsp;- specyfikacja sprzętu i roweru<br>
                            &nbsp;&nbsp;<b>ping</b>&nbsp;&nbsp;&nbsp;&nbsp;- test opóźnienia do API<br>
                            &nbsp;&nbsp;<b>zapros</b>&nbsp;&nbsp;- link do zaproszenia na Discord<br>
                            &nbsp;&nbsp;<b>motyw</b>&nbsp;&nbsp;&nbsp;- zmienia motyw terminala<br>
                            &nbsp;&nbsp;<b>clear</b>&nbsp;&nbsp;&nbsp;- czyści ekran
                        `;
                        if (isAdminLogged) {
                            helpText += `<br><br><span style="color:#fbc02d;">Admin:</span><br>&nbsp;&nbsp;<b>reboot</b>&nbsp;- zdalny restart bota`;
                        }
                        response.innerHTML = helpText;
                        break;
                    case 'reboot':
                        if (isAdminLogged) {
                            response.innerHTML = `<span style="color:#fbc02d;">Wysyłanie sygnału restartu do serwera...</span>`;
                            fetch('/api/reboot', { method: 'POST' })
                            .then(() => { response.innerHTML += `<br><span style="color:#23a559;">Restart w toku.</span>`; })
                            .catch(() => { response.innerHTML += `<br><span style="color:#f23f42;">Błąd.</span>`; });
                        } else {
                            response.innerHTML = `bash: reboot: odmowa dostępu. Musisz zalogować się przez Discord.`;
                        }
                        break;
                    case 'setup':
                        response.innerHTML = `<span style="color:#23a559;">[ PC ]</span> Ryzen 5, RTX 3060, 16GB RAM<br><span style="color:#23a559;">[ Rower ]</span> Szosa / Gravel`;
                        break;
                    case 'ping':
                        response.innerHTML = `Gateway Discord: <span style="color:#23a559;">${Math.floor(Math.random() * 8) + 22}ms</span>`;
                        break;
                    case 'zapros':
                        response.innerHTML = `<a href="https://discord.com/users/${discordId}" target="_blank">Profil Discord</a>`;
                        break;
                    case 'motyw':
                        mainTerminal.classList.toggle('theme-hacker');
                        response.innerHTML = "Zmieniono motyw.";
                        break;
                    case 'clear':
                        termOutput.innerHTML = '';
                        return;
                    default:
                        fetch('/api/terminal', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ command: command })
                        }).then(res => res.json()).then(data => {
                            response.innerHTML = (data.output || data.error || 'Brak odpowiedzi.').replace(/\n/g, '<br>');
                            response.style.marginBottom = "10px";
                            termOutput.appendChild(response);
                            termOutput.scrollTop = termOutput.scrollHeight;
                        }).catch(() => {
                            response.innerHTML = `bash: ${command}: nieznane polecenie. Wpisz 'pomoc'.`;
                            response.style.marginBottom = "10px";
                            termOutput.appendChild(response);
                            termOutput.scrollTop = termOutput.scrollHeight;
                        });
                        return;
                }
                response.style.marginBottom = "10px";
                termOutput.appendChild(response);
                termOutput.scrollTop = termOutput.scrollHeight;
            });
        }
    }

    document.querySelectorAll('.skill-tag').forEach(tag => {
        tag.addEventListener('click', (e) => {
            openTerminalClean(false);
            setTimeout(() => {
                termOutput.innerHTML += `<div>root@rapldez: cat skill_${e.target.getAttribute('data-lang').toLowerCase()}.sh</div><div style="color:#a0a0a0; margin-bottom:10px;">Aktywny system testowy.</div>`;
                termInput.focus();
            }, 300);
        });
    });

    const openContactBtn = document.getElementById('open-contact'), closeContactBtn = document.getElementById('close-contact'), contactOverlay = document.getElementById('contact-overlay'), sendContactBtn = document.getElementById('send-contact-btn');
    if(openContactBtn && contactOverlay) {
        openContactBtn.addEventListener('click', () => {
            contactOverlay.style.opacity = '1';
            contactOverlay.style.pointerEvents = 'auto';
        });
        closeContactBtn.addEventListener('click', () => {
            contactOverlay.style.opacity = '0';
            contactOverlay.style.pointerEvents = 'none';
        });
        sendContactBtn.addEventListener('click', () => {
            const nick = document.getElementById('contact-nick').value.trim();
            const subject = document.getElementById('contact-subject').value.trim();
            const message = document.getElementById('contact-message').value.trim();
            if(!nick || !message || !subject) { showToast("Wypełnij pola!", "error"); return; }
            
            showToast("Wysyłanie...", "success");
            fetch('/api/kontakt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nick, subject, message })
            }).then(res => res.json()).then(data => {
                showToast(data.message || "Wysłano!", "success");
                contactOverlay.style.opacity = '0';
                contactOverlay.style.pointerEvents = 'none';
            }).catch(() => showToast("Błąd wysyłania", "error"));
        });
    }

    fetch('/api/views').then(res => res.json()).then(data => {
        if (data.views) document.getElementById('live-counter').innerText = data.views;
    }).catch(err => {});
});