import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function RenderedScreen() {
  return (
    <ScrollView style={styles.container}>
<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" name="viewport">
<title>Configuration</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            app: {
              bg: '#0F0F12',
              card: '#161618',
              cardborder: '#27272A',
              text: '#E4E4E7',
              muted: '#A1A1AA',
              accent: '#5c77ff',
              accentbg: 'rgba(92, 119, 255, 0.1)',
              togglebg: '#3F3F46',
              toggleactive: '#5c77ff',
            }
          },
          fontFamily: {
            sans: ['Inter', 'system-ui', 'sans-serif'],
            mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', "Liberation Mono", "Courier New", 'monospace'],
          }
        }
      }
    }
  </script>
<style data-purpose="custom-utilities">
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    body {
      background-color: #0F0F12;
      color: #E4E4E7;
      font-family: 'Inter', sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* Custom scrollbar hide for cleaner look if needed */
    ::-webkit-scrollbar {
      display: none;
    }
    
    /* Toggle Switch Styles */
    .toggle-checkbox:checked {
      right: 0;
      border-color: #5c77ff;
    }
    .toggle-checkbox:checked + .toggle-label {
      background-color: #5c77ff;
    }
    .toggle-checkbox {
      right: 0;
      z-index: 1;
      border-color: #e2e8f0;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toggle-label {
      width: 2.25rem;
      height: 1.25rem;
      background-color: #3F3F46;
      border-radius: 9999px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toggle-knob {
      width: 1rem;
      height: 1rem;
      background-color: white;
      border-radius: 50%;
      position: absolute;
      top: 0.125rem;
      left: 0.125rem;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .toggle-checkbox:checked + .toggle-label .toggle-knob {
      transform: translateX(1rem);
    }

    /* Entrance Animations */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .reveal-section {
      opacity: 0;
      animation: fadeInUp 0.5s ease-out forwards;
    }

    /* Shimmer Effect for Profile Header */
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .shimmer-text {
      background: linear-gradient(90deg, #E4E4E7 0%, #5c77ff 50%, #E4E4E7 100%);
      background-size: 200% auto;
      color: transparent;
      -webkit-background-clip: text;
      background-clip: text;
      animation: shimmer 4s linear infinite;
    }

    /* Neon Glow Pulse */
    @keyframes neonPulse {
      0% { box-shadow: 0 0 5px rgba(92, 119, 255, 0.2); }
      50% { box-shadow: 0 0 15px rgba(92, 119, 255, 0.5); }
      100% { box-shadow: 0 0 5px rgba(92, 119, 255, 0.2); }
    }
    .active-glow {
      animation: neonPulse 2s ease-in-out infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      .reveal-section {
        animation: none;
        opacity: 1;
      }
      .shimmer-text {
        animation: none;
        color: #E4E4E7;
      }
      .active-glow {
        animation: none;
      }
      .toggle-checkbox, .toggle-label, .toggle-knob {
        transition: none;
      }
    }
  </style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;display=swap" data-snapdom="injected-import"></head>
<body class="bg-app-bg text-app-text min-h-screen pb-24 font-sans">
<!-- BEGIN: Top Navigation Bar -->
<header class="flex items-center justify-between px-4 py-4 border-b border-app-cardborder sticky top-0 bg-app-bg/90 backdrop-blur z-10">
<View>
<!-- App Icon Placeholder -->
<svg class="w-6 h-6 text-app-accent" fill="currentColor" viewBox="0 0 24 24">
<Text></path>
</svg>
<span class="text-xl font-bold">Buddy</span>
</View>
<!-- User Profile Avatar -->
<View>
<img alt="User Avatar" class="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBKBAt7TXxUG-gNFs1E4UY_7pFcaCA4rDTamyde8Va1LS5gCzveKv4wRRLjBj1HXDuQviGTK8Nwfsv8DwF9a3iKVJ4b2fZgJcAHxEZvUY9tgLwVcT2P40P8Qb-m4e6d3VdpKnhF6ZVrXJ0kFH5E2I4zf2O1hgQqVMy0O9lsSX8XYEG-F-wQ63C9-PBu61fIwfOBeHrWcZqh57VbcjLL-pPSPEwfw3Roi-lmlMjtkDHYqRhzgiv93VS33JuHQ1N4EWz1XWnKrhBGnTvu">
</View>
</header>
<!-- END: Top Navigation Bar -->
<main class="px-4 pt-6 pb-8 space-y-6">
<!-- BEGIN: Header Section -->
<section class="reveal-section" style="animation-delay: 0.1s">
<Text>Configuration</Text>
<Text>Manage developer preferences, data telemetry, and core settings.</Text>
</section>
<!-- END: Header Section -->
<!-- BEGIN: Neural Synthesis Profile Section -->
<section class="bg-app-card border border-app-cardborder rounded-2xl p-5 reveal-section" style="animation-delay: 0.2s">
<View>
<View>
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<Text>Neural Synthesis Profile</Text>
</View>
<View>
<!-- Selected Option -->
<label class="block relative rounded-xl border border-app-accent bg-app-accentbg p-4 cursor-pointer transition-all active:scale-[0.98]">
<input checked="" class="sr-only" name="neural_profile" type="radio" value="nova">
<View>
<View>
<View>Nova (Default)</View>
<View>Energetic, clear, slightly robotic undertone. Optimized for navigation.</View>
</View>
<View>
<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
<Text></path>
</svg>
</View>
</View>
</label>
<!-- Unselected Option -->
<label class="block relative rounded-xl border border-app-cardborder bg-app-bg p-4 cursor-pointer hover:border-app-muted/50 transition-all active:scale-[0.98]">
<input class="sr-only" name="neural_profile" type="radio" value="echo">
<View>
<View>
<View>Echo (Beta)</View>
<View>Deep, resonant, calm. Requires persistent network connection.</View>
</View>
</View>
</label>
</View>
<View>
<View>Model version: v2.4.1-stable</View>
<TouchableOpacity>Test Output</TouchableOpacity>
</View>
</section>
<!-- END: Neural Synthesis Profile Section -->
<!-- BEGIN: Telemetry & Sync Section -->
<section class="bg-app-card border border-app-cardborder rounded-2xl p-5 reveal-section" style="animation-delay: 0.3s">
<View>
<View>
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<Text>Telemetry &amp; Sync</Text>
</View>
<View>
<!-- Toggle Item 1 -->
<View>
<View>
<View>Background Sync</View>
<View>Continuous location processing</View>
</View>
<View>
<input checked="" class="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer opacity-0" id="toggle_bg_sync" name="toggle_bg_sync" type="checkbox">
<label class="toggle-label block overflow-hidden h-5 rounded-full cursor-pointer relative" for="toggle_bg_sync">
<span class="toggle-knob"></span>
</label>
</View>
</View>
<!-- Toggle Item 2 -->
<View>
<View>
<View>Offline Caching</View>
<View>Store maps up to 2GB</View>
</View>
<View>
<input class="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer opacity-0" id="toggle_offline" name="toggle_offline" type="checkbox">
<label class="toggle-label block overflow-hidden h-5 rounded-full bg-app-togglebg cursor-pointer relative" for="toggle_offline">
<span class="toggle-knob"></span>
</label>
</View>
</View>
<!-- Toggle Item 3 -->
<View>
<View>
<View>Hot-Spot Suggestions</View>
<View>Receive real-time intelligence on high-activity areas.</View>
</View>
<View>
<input class="toggle-checkbox absolute block w-4 h-4 rounded-full bg-white border-4 appearance-none cursor-pointer opacity-0" id="toggle_hotspot" name="toggle_hotspot" type="checkbox">
<label class="toggle-label block overflow-hidden h-5 rounded-full bg-app-togglebg cursor-pointer relative" for="toggle_hotspot">
<span class="toggle-knob"></span>
</label>
</View>
</View>
</View>
</section>
<!-- END: Telemetry & Sync Section -->
<!-- BEGIN: Privacy Protocols Section -->
<section class="bg-app-card border border-app-cardborder rounded-2xl p-5 reveal-section" style="animation-delay: 0.4s">
<View>
<View>
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<Text>Privacy Protocols</Text>
</View>
<View>
<!-- Action Button 1 -->
<TouchableOpacity>
<View>
<svg class="w-5 h-5 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
<span class="font-medium text-white">Clear Routing History</span>
</View>
<svg class="w-5 h-5 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<!-- Action Button 2 -->
<TouchableOpacity>
<View>
<svg class="w-5 h-5 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
<span class="font-medium text-white">Manage Voice Recordings</span>
</View>
<svg class="w-5 h-5 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
</View>
</section>
<!-- END: Privacy Protocols Section -->
<!-- BEGIN: Rendering Engine Section -->
<section class="bg-app-card border border-app-cardborder rounded-2xl p-5 mb-8 reveal-section" style="animation-delay: 0.5s">
<View>
<View>
<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</View>
<Text>Rendering Engine</Text>
</View>
<!-- Segmented Control -->
<View>
<TouchableOpacity>
<svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
<span class="text-sm font-medium">Obsidian</span>
</TouchableOpacity>
<TouchableOpacity>
<svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
<span class="text-sm font-medium">Satellite</span>
</TouchableOpacity>
<TouchableOpacity>
<svg class="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
<span class="text-sm font-medium">Vector Wire</span>
</TouchableOpacity>
</View>
</section>
<!-- END: Rendering Engine Section -->
</main>
<!-- BEGIN: Bottom Floating Navigation -->
<nav class="fixed bottom-6 left-4 right-4 bg-app-card/90 backdrop-blur-md border border-app-cardborder rounded-full flex justify-around items-center py-2 px-2 shadow-2xl reveal-section" style="animation-delay: 0.6s">
<TouchableOpacity>
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
</svg>
</TouchableOpacity>
<TouchableOpacity>
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
<Text></path>
<Text></path>
</svg>
</TouchableOpacity>
</nav>
<!-- END: Bottom Floating Navigation -->
<script>
  // Script to handle interactive states if needed beyond pure CSS
  document.addEventListener('DOMContentLoaded', () => {
    // Neural Profile Selection interaction
    const profileRadios = document.querySelectorAll('input[name="neural_profile"]');
    profileRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const labels = document.querySelectorAll('input[name="neural_profile"] + div').forEach(div => {
          div.parentElement.classList.remove('border-app-accent', 'bg-app-accentbg');
          div.parentElement.classList.add('border-app-cardborder', 'bg-app-bg');
          const checkIcon = div.querySelector('.text-app-accent');
          if (checkIcon) checkIcon.remove();
        });
        
        if (e.target.checked) {
          const parent = e.target.parentElement;
          parent.classList.add('border-app-accent', 'bg-app-accentbg');
          parent.classList.remove('border-app-cardborder', 'bg-app-bg');
          
          const iconContainer = document.createElement('div');
          iconContainer.className = 'text-app-accent flex-shrink-0 mt-0.5';
          iconContainer.innerHTML = `<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><Text></path></svg>`;
          parent.querySelector('.flex.justify-between').appendChild(iconContainer);
        }
      });
    });

    // Rendering Engine Selection
    const engineButtons = document.querySelectorAll('.grid-cols-3 button');
    engineButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        engineButtons.forEach(b => {
          b.classList.remove('border-app-accent', 'bg-app-accentbg', 'text-app-accent', 'active-glow');
          b.classList.add('border-app-cardborder', 'bg-app-bg', 'text-app-muted');
        });
        btn.classList.add('border-app-accent', 'bg-app-accentbg', 'text-app-accent', 'active-glow');
        btn.classList.remove('border-app-cardborder', 'bg-app-bg', 'text-app-muted');
      });
    });
  });
</script>
</body></html>    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    padding: 16,
  },
});
