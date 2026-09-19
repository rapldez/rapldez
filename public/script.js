document.addEventListener('DOMContentLoaded', () => {
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
                            if (p.spotify.timestamps && p.spotify.timestamps.start) activeActivityStart = p.spotify.timestamps.start;
                        } else if (p.activities && p.activities.length > 0) {
                            const game = p.activities.find(x => x.type === 0);
                            if (game) {
                                baseStatusHtml = `<i class="fa-solid fa-gamepad" style="color:#a0a0a0; margin-right:4px;"></i>Gra w: ${game.name}`;
                                if (game.timestamps && game.timestamps.start) activeActivityStart = game.timestamps.start;
                            }
                        } else {
                            let sTxt = 'Offline';
                            if (p.discord_status === 'online') sTxt = 'Online';
                            else if (p.discord_status === 'idle') sTxt = 'Zaraz wracam';
                            else if (p.discord_status === 'dnd') sTxt = 'Nie przeszkadzać';
                            baseStatusHtml = sTxt;
                        }

                        updateStatusDisplay();

                        if (p.discord_user && discordAvatar) {
                            const isAnimated = p.discord_user.avatar && p.discord_user.avatar.startsWith('a_');
                            const ext = isAnimated ? 'gif' : 'png';
                            if(p.discord_user.avatar) {
                                discordAvatar.src = `https://cdn.discordapp.com/avatars/${p.discord_user.id}/${p.discord_user.avatar}.${ext}?size=512`;
                            }

                            if (badgesContainer && p.t === 'INIT_STATE') {
                                badgesContainer.innerHTML = '';
                                const flags = p.discord_user.public_flags;
                                let badgeHtml = '';
                                
                                if (isAnimated) badgeHtml += `<img src="${BADGES.NITRO}" class="badge-icon" title="Discord Nitro">`;
                                if (flags & 64) badgeHtml += `<img src="${BADGES.HYPE_BRAVERY}" class="badge-icon" title="HypeSquad Bravery">`;
                                if (flags & 128) badgeHtml += `<img src="${BADGES.HYPE_BRILLIANCE}" class="badge-icon" title="HypeSquad Brilliance">`;
                                if (flags & 256) badgeHtml += `<img src="${BADGES.HYPE_BALANCE}" class="badge-icon" title="HypeSquad Balance">`;
                                if (flags & 512) badgeHtml += `<img src="${BADGES.EARLY_SUPPORTER}" class="badge-icon" title="Early Supporter">`;
                                if (flags & 4194304) badgeHtml += `<img src="${BADGES.ACTIVE_DEV}" class="badge-icon" title="Active Developer">`;

                                badgesContainer.innerHTML = badgeHtml;
                            }
                        }
                    }
                }
            });
        } catch(e) { console.warn("Lanyard error", e); }
    }

    function updateStatusDisplay() {
        if (!discordStatusText) return;
        if (activeActivityStart) {
            let diff = Math.floor((Date.now() - activeActivityStart) / 1000);
            if (diff < 0) diff = 0;
            let h = Math.floor(diff / 3600);
            let m = Math.floor((diff % 3600) / 60);
            let s = diff % 60;
            let timeStr = h > 0 ? `${h}h ${m}m` : `${m}m ${s < 10 ? '0'+s : s}s`;
            discordStatusText.innerHTML = `${baseStatusHtml} (od ${timeStr})`;
        } else {
            discordStatusText.innerHTML = baseStatusHtml;
        }
    }

    const inviteCode = "cyvKv8YvU7"; 
    fetch(`https://discord.com/api/v9/invites/${inviteCode}?with_counts=true`)
        .then(response => { if (!response.ok) throw new Error("API error"); return response.json(); })
        .then(data => {
            if (data && data.guild) {
                const srvName = document.getElementById('discord-server-name');
                const srvStats = document.getElementById('discord-server-stats');
                const srvIcon = document.getElementById('discord-server-icon');
                if (srvName) srvName.innerText = data.guild.name;
                if (srvStats) srvStats.innerHTML = `<span class="stats-dot"></span> ${data.approximate_presence_count} Online • ${data.approximate_member_count} Members`;
                if (srvIcon && data.guild.icon) srvIcon.src = `https://cdn.discordapp.com/icons/${data.guild.id}/${data.guild.icon}.png`;
            }
        })
        .catch(err => {});

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
                const p = lines[currentLine];
                const span = p.querySelector('span');
                const fullText = p.getAttribute('data-text');
                span.style.visibility = 'visible';
                span.innerHTML = '';
                
                let charIndex = 0;
                function typeChar() {
                    if (charIndex < fullText.length) {
                        span.innerHTML += fullText.charAt(charIndex);
                        charIndex++;
                        setTimeout(typeChar, 10); 
                    } else {
                        if (currentLine === 1 && skillsBlock) {
                            skillsBlock.style.transition = "opacity 0.5s";
                            skillsBlock.style.opacity = "1";
                        }
                        currentLine++;
                        setTimeout(typeNextLine, 200);
                    }
                }
                typeChar();
            }
        }
        typeNextLine();
    }

    function updateClock() {
        if(liveClock) {
            const now = new Date();
            liveClock.innerText = now.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second:'2-digit' });
        }
        updateStatusDisplay();
    }
    setInterval(updateClock, 1000);
    updateClock();

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        let min = Math.floor(seconds / 60);
        let sec = Math.floor(seconds % 60);
        if(sec < 10) sec = '0' + sec;
        return min + ':' + sec;
    }

    if (enterScreen) {
        enterScreen.addEventListener('click', () => {
            enterScreen.style.opacity = '0';
            setTimeout(() => { enterScreen.style.display = 'none'; }, 500);
            if (mainContent) { mainContent.style.opacity = '1'; mainContent.style.pointerEvents = 'auto'; }

            const startVol = volumeSlider ? volumeSlider.value : 0.15;
            if (bgAudio) { bgAudio.volume = startVol; bgAudio.play().catch(e=>{}); }
            if (bgVideo) { bgVideo.muted = true; bgVideo.play().catch(e=>{}); }
            
            setTimeout(() => {
                typeWriterTitle();
                typeAboutMe();
            }, 500);
        });
    }

    const openTermBtn = document.getElementById('open-terminal');
    const closeTermBtn = document.getElementById('close-terminal');
    const termOverlay = document.getElementById('terminal-overlay');
    const termInput = document.getElementById('terminal-input');
    const termOutput = document.getElementById('terminal-output');
    const mainTerminal = document.getElementById('main-terminal');

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
        } else {
            termOutput.innerHTML = `<div>[ rapldez OS v1.0 ]</div>`;
        }
        
        setTimeout(() => { termInput.focus(); }, 100);
    }

    if(openTermBtn && termOverlay) {
        openTermBtn.addEventListener('click', () => {
            openTerminalClean(true);
        });
        
        closeTermBtn.addEventListener('click', () => {
            termOverlay.style.opacity = '0';
            termOverlay.style.pointerEvents = 'none';
        });

        // POPRAWIONE KLUCZOWE NASŁUCHIWANIE ENTERA W TERMINALU
        termInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.keyCode === 13) {
                e.preventDefault();
                const command = this.value.trim().toLowerCase();
                this.value = '';
                
                const cmdEcho = document.createElement('div');
                cmdEcho.innerHTML = `<span class="prompt">root@rapldez:</span> <span style="color:white;">${command}</span>`;
                termOutput.appendChild(cmdEcho);

                const response = document.createElement('div');
                
                switch(command) {
                    case 'pomoc':
                        response.innerHTML = `
                            Dostępne polecenia systemowe:<br>
                            &nbsp;&nbsp;<b>setup</b>&nbsp;&nbsp;&nbsp;&nbsp;- specyfikacja sprzętu i roweru<br>
                            &nbsp;&nbsp;<b>ping</b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- test opóźnienia do API Discorda<br>
                            &nbsp;&nbsp;<b>zapros</b>&nbsp;&nbsp;&nbsp;- link do zaproszenia na Discord<br>
                            &nbsp;&nbsp;<b>motyw</b>&nbsp;&nbsp;&nbsp;&nbsp;- zmienia motyw terminala<br>
                            &nbsp;&nbsp;<b>clear</b>&nbsp;&nbsp;&nbsp;&nbsp;- czyści ekran terminala
                        `;
                        break;
                    case 'setup':
                        response.innerHTML = `
                            <span style="color:#23a559;">[ Sprzęt PC ]</span><br>
                            CPU: AMD Ryzen 5<br>
                            GPU: NVIDIA GeForce RTX 3060<br>
                            RAM: 16GB DDR4<br>
                            Monitor: 144Hz IPS<br><br>
                            <span style="color:#23a559;">[ Sprzęt Rowerowy ]</span><br>
                            Szosa: Szosówka śmigająca po szosie<br>
                            Gravel: Gravel na bezdroża
                        `;
                        break;
                    case 'ping':
                        const simulatedPing = Math.floor(Math.random() * 8) + 22; 
                        response.innerHTML = `
                            Badanie opóźnienia API Discorda <span style="color:#f0b232;">(gateway.discord.gg)</span>...<br>
                            Czas odpowiedzi: <span style="color:#23a559;">${simulatedPing}ms</span><br>
                            Status połączenia Lanyard: <span style="color:#23a559;">Stabilne</span>
                        `;
                        break;
                    case 'zapros':
                        response.innerHTML = `
                            <a href="https://discord.com/users/920029957739139083" target="_blank" style="display:inline-block; margin-top:10px; padding:8px 15px; background:linear-gradient(45deg, #d4af37, #f3e5ab); color:black; text-decoration:none; font-weight:bold; border-radius:5px; text-transform:uppercase;">Dodaj do znajomych na Discord</a>
                        `;
                        break;
                    case 'motyw':
                        if(mainTerminal.classList.contains('theme-hacker')) {
                            mainTerminal.classList.remove('theme-hacker');
                            response.innerHTML = "Zmieniono motyw na: Domyślny";
                        } else {
                            mainTerminal.classList.add('theme-hacker');
                            response.innerHTML = "Zmieniono motyw na: Hacker";
                        }
                        break;
                    case 'clear':
                        termOutput.innerHTML = '';
                        return;
                    case '':
                        return;
                    default:
                        response.innerHTML = `bash: ${command}: nie rozpoznano polecenia. Wpisz 'pomoc'.`;
                        break;
                }
                response.style.marginBottom = "10px";
                termOutput.appendChild(response);
                termOutput.scrollTop = termOutput.scrollHeight;
            }
        });
    }

    // ŚMIESZNE I ZAJEBISTE TEKSTY POD KAFELKAMI SKILLS (LUA, NODE.JS, PYTHON, SQL)
    const skillTags = document.querySelectorAll('.skill-tag');
    const codeSnippets = {
        'Lua': `🔥 [MTA Scripting Engine]<br>addCommandHandler("slaba_forma", function(plr)<br>&nbsp;&nbsp;outputChatBox("#ff3333[ERROR] Brak paliwa w żyłach! Wymagana kawa.", plr, 255, 255, 255, true)<br>end)<br><span style="color:#23a559;">> Status: Wjeżdża bokiem na każdym serwerze RPG!</span>`,
        'Node.js': `⚡ [Backend Wizardry]<br>app.get("/api/sigma", (req, res) => {<br>&nbsp;&nbsp;res.json({ vibe: "Nie do pobicia", coffeeLevel: "100%" });<br>);<br><span style="color:#66bb6a;">> Status: Strona i bot żyją w symbiozie 24/7 na Renderze!</span>`,
        'Python': `🐍 [The Almighty Script]<br>try:<br>&nbsp;&nbsp;import coffee_machine<br>&nbsp;&nbsp;coffee_machine.brew_fresh()<br>except Exception:<br>&nbsp;&nbsp;print("Panic! Znowu brak kofeiny w ekspresie.")<br><span style="color:#ffee58;">> Status: Automatyzuje nudne rzeczy, żeby Radek mógł jeździć na szosie!</span>`,
        'SQL': `🛢️ [Database Destroyer]<br>SELECT * FROM brain_cells WHERE status = 'missing_at_3am';<br><span style="color:#f23f42;">> Warning: Wykryto zerową aktywność szarych komórek po północy!</span><br><span style="color:#ffa726;">> Status: Tabela ticketerów rośnie szybciej niż km na gravelu.</span>`
    };

    skillTags.forEach(tag => {
        tag.addEventListener('click', (e) => {
            const lang = e.target.getAttribute('data-lang');
            if(codeSnippets[lang]) {
                openTerminalClean(false);
                
                setTimeout(() => {
                    const cmdEcho = document.createElement('div');
                    cmdEcho.innerHTML = `<span class="prompt">root@rapldez:</span> <span style="color:white;">cat skill_${lang.toLowerCase()}.sh</span>`;
                    termOutput.appendChild(cmdEcho);

                    const response = document.createElement('div');
                    response.innerHTML = `<span style="color:#a0a0a0;">${codeSnippets[lang]}</span>`;
                    response.style.marginBottom = "10px";
                    termOutput.appendChild(response);
                    termOutput.scrollTop = termOutput.scrollHeight;
                    
                    termInput.focus();
                }, 400); 
            }
        });
    });

    const openContactBtn = document.getElementById('open-contact');
    const closeContactBtn = document.getElementById('close-contact');
    const contactOverlay = document.getElementById('contact-overlay');
    const sendContactBtn = document.getElementById('send-contact-btn');
    const contactStatus = document.getElementById('contact-status');

    if(openContactBtn && contactOverlay) {
        openContactBtn.addEventListener('click', () => {
            contactOverlay.style.opacity = '1';
            contactOverlay.style.pointerEvents = 'auto';
        });
        closeContactBtn.addEventListener('click', () => {
            contactOverlay.style.opacity = '0';
            contactOverlay.style.pointerEvents = 'none';
            contactStatus.innerText = '';
        });

        sendContactBtn.addEventListener('click', () => {
            const nick = document.getElementById('contact-nick').value.trim();
            const discord = document.getElementById('contact-discord').value.trim();
            const subject = document.getElementById('contact-subject').value.trim();
            const message = document.getElementById('contact-message').value.trim();

            if(!nick || !message || !subject) {
                contactStatus.style.color = "#f23f42";
                contactStatus.innerText = "Wypełnij wymagane pola (Nick, Temat, Wiadomość)!";
                return;
            }

            contactStatus.style.color = "#23a559";
            contactStatus.innerText = "Wysyłanie zgłoszenia...";
            sendContactBtn.disabled = true;

            const formData = { nick, discordId: discord, subject, message };

            fetch('/api/kontakt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })
            .then(res => res.json())
            .then(data => {
                contactStatus.innerText = "Zgłoszenie wysłane pomyślnie!";
                document.getElementById('contact-nick').value = '';
                document.getElementById('contact-discord').value = '';
                document.getElementById('contact-subject').value = '';
                document.getElementById('contact-message').value = '';
                setTimeout(() => {
                    contactOverlay.style.opacity = '0';
                    contactOverlay.style.pointerEvents = 'none';
                    sendContactBtn.disabled = false;
                    contactStatus.innerText = '';
                }, 2500);
            })
            .catch(err => {
                contactStatus.style.color = "#f23f42";
                contactStatus.innerText = "Wystąpił błąd serwera.";
                sendContactBtn.disabled = false;
            });
        });
    }

    const customMenu = document.getElementById('custom-menu');
    if (customMenu) {
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            customMenu.style.display = 'block';
            customMenu.style.left = e.pageX + 'px';
            customMenu.style.top = e.pageY + 'px';
        });
        
        document.addEventListener('click', () => {
            customMenu.style.display = 'none';
        });

        document.getElementById('menu-copy-id').addEventListener('click', () => {
            navigator.clipboard.writeText(discordId).then(() => {
                const originalText = document.getElementById('menu-copy-id').innerHTML;
                document.getElementById('menu-copy-id').innerHTML = '<i class="fa-solid fa-check"></i> Skopiowano!';
                setTimeout(() => { document.getElementById('menu-copy-id').innerHTML = originalText; }, 2000);
            });
        });

        document.getElementById('menu-mute').addEventListener('click', () => {
            if(muteIcon) muteIcon.click();
        });

        document.getElementById('menu-terminal').addEventListener('click', () => {
            if(openTermBtn) openTermBtn.click();
        });
    }

    if (volumeSlider) {
        volumeSlider.addEventListener('input', (e) => {
            const vol = e.target.value;
            if (bgAudio) bgAudio.volume = vol;
            if (vol == 0) { if(muteIcon) muteIcon.className = "fa-solid fa-volume-xmark"; }
            else if (vol < 0.5) { if(muteIcon) muteIcon.className = "fa-solid fa-volume-low"; }
            else { if(muteIcon) muteIcon.className = "fa-solid fa-volume-high"; }
        });

        if(muteIcon) {
            muteIcon.addEventListener('click', () => {
                const currentVol = bgAudio ? bgAudio.volume : 0;
                if (currentVol > 0) {
                    if (bgAudio) { bgAudio.dataset.lastVolume = currentVol; bgAudio.volume = 0; }
                    volumeSlider.value = 0;
                    muteIcon.className = "fa-solid fa-volume-xmark";
                } else {
                    const lastVol = (bgAudio && bgAudio.dataset.lastVolume) ? bgAudio.dataset.lastVolume : 0.15;
                    if (bgAudio) bgAudio.volume = lastVol;
                    volumeSlider.value = lastVol;
                    muteIcon.className = lastVol < 0.5 ? "fa-solid fa-volume-low" : "fa-solid fa-volume-high";
                }
            });
        }
    }

    if(bgAudio && playPauseBtn && trackProgress && currTimeDisp && totalTimeDisp) {
        playPauseBtn.addEventListener('click', () => {
            if(bgAudio.paused) { bgAudio.play(); playPauseBtn.className = "fa-solid fa-pause"; } 
            else { bgAudio.pause(); playPauseBtn.className = "fa-solid fa-play"; }
        });

        if(prevTrackBtn) {
            prevTrackBtn.addEventListener('click', () => {
                bgAudio.currentTime = 0;
                bgAudio.play().catch(e=>{});
                playPauseBtn.className = "fa-solid fa-pause";
            });
        }

        if(nextTrackBtn) {
            nextTrackBtn.addEventListener('click', () => {
                bgAudio.currentTime = 0;
                bgAudio.play().catch(e=>{});
                playPauseBtn.className = "fa-solid fa-pause";
            });
        }

        bgAudio.addEventListener('timeupdate', () => {
            if(bgAudio.duration) {
                trackProgress.value = (bgAudio.currentTime / bgAudio.duration) * 100;
                currTimeDisp.innerText = formatTime(bgAudio.currentTime);
                totalTimeDisp.innerText = formatTime(bgAudio.duration);
            }
        });
        trackProgress.addEventListener('input', (e) => {
            if(bgAudio.duration) bgAudio.currentTime = (e.target.value / 100) * bgAudio.duration;
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (cursorTrail) {
            cursorTrail.style.left = e.clientX + 'px';
            cursorTrail.style.top = e.clientY + 'px';
        }
        if (mainContent && mainContent.style.opacity === '1' && card) {
            const xAxis = (window.innerWidth / 2 - e.pageX) / 40; 
            const yAxis = (window.innerHeight / 2 - e.pageY) / 40;
            card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`;
        }
    });

    const titleText = "@rapldez";
    let titleIndex = 0;
    let direction = 1;
    function animateTitle() {
        document.title = titleText.substring(0, titleIndex) || "\u200B";
        titleIndex += direction;
        let delay = 250;
        if (titleIndex === titleText.length + 1) { direction = -1; delay = 1500; titleIndex = titleText.length - 1; } 
        else if (titleIndex === 0) { direction = 1; delay = 500; } 
        else if (direction === -1) { delay = 100; }
        setTimeout(animateTitle, delay);
    }
    animateTitle();
});
