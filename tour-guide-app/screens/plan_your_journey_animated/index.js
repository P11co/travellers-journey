import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';

export default function RenderedScreen() {
  return (
    <ScrollView style={styles.container}>
<!DOCTYPE html><html class="bg-[#131313] text-gray-200 font-sans" lang="en"><head>
<meta charset="utf-8">
<meta content="width=device-width, initial-scale=1.0" name="viewport">
<title>Plan Your Journey - Buddy</title>
<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"></script>
<style>
    /* Custom Scrollbar for nicer dark mode look */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #131313;
    }
    ::-webkit-scrollbar-thumb {
      background: #333;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #555;
    }
    
    .timeline-line {
      position: absolute;
      left: 1.25rem; /* 20px - matches w-10 center */
      top: 2rem; /* Start below the first circle */
      bottom: -1rem;
      width: 1px;
      background-color: #333;
      z-index: 0;
    }

    /* Energy Shimmer Effect */
    @keyframes energy-shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    .energy-shimmer {
      background: linear-gradient(90deg, #5c77ff 0%, #a5b4ff 50%, #5c77ff 100%);
      background-size: 200% auto;
      animation: energy-shimmer 3s linear infinite;
    }
    @media (prefers-reduced-motion: reduce) {
      .energy-shimmer {
        animation: none;
      }
    }

    /* Checkmark Animation */
    .checkmark-svg path {
      stroke-dasharray: 20;
      stroke-dashoffset: 20;
      transition: stroke-dashoffset 0.3s ease-in-out;
    }
    input:checked + .custom-checkbox .checkmark-svg path {
      stroke-dashoffset: 0;
    }

    /* Parallax Container */
    .parallax-container {
      perspective: 1000px;
    }
    .parallax-card {
      transition: transform 0.1s ease-out;
      transform-style: preserve-3d;
    }
    .parallax-bg {
      transition: transform 0.1s ease-out;
      transform: scale(1.1); /* Over-scale to prevent edges showing during parallax */
    }
    @media (prefers-reduced-motion: reduce) {
      .parallax-card, .parallax-bg {
        transition: none !important;
        transform: none !important;
      }
    }
  </style>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
</head>
<body class="antialiased min-h-screen pb-24">
<!-- BEGIN: Header -->
<header class="sticky top-0 z-50 bg-[#131313]/90 backdrop-blur border-b border-gray-800 px-4 py-3 flex items-center justify-between">
<View>
<i class="fa-solid fa-robot"></i>
<span class="">Buddy</span>
</View>
<TouchableOpacity>
<i class="fa-solid fa-bars"></i>
</TouchableOpacity>
</header>
<!-- END: Header -->
<!-- BEGIN: MainContent -->
<main class="px-4 pt-8 pb-4 max-w-md mx-auto">
<!-- Hero Text -->
<View>
<Text>Plan Your Journey</Text>
<Text>Select your preferred destinations and customize your itinerary settings to generate a personalized route.</Text>
</View>
<!-- BEGIN: PreferencesSection -->
<section class="bg-[#1a1a1a] rounded-2xl p-5 mb-6 border border-gray-800">
<View>
<i class="fa-solid fa-sliders text-[#5c77ff]"></i>
<Text>Preferences</Text>
</View>
<View>
<!-- Budget Level -->
<View>
<label class="block text-xs text-gray-400 mb-1.5">Budget Level</label>
<View>
<View>
<i class="fa-solid fa-money-bill-1-wave"></i>
</View>
<select class="block w-full pl-10 pr-10 py-2.5 bg-[#131313] border border-gray-700 rounded-xl text-white text-sm focus:ring-[#5c77ff] focus:border-[#5c77ff] appearance-none">
<option>Standard</option>
<option>Budget</option>
<option>Luxury</option>
</select>
<View>
<i class="fa-solid fa-chevron-down text-xs"></i>
</View>
</View>
</View>
<!-- Available Time -->
<View>
<label class="block text-xs text-gray-400 mb-1.5">Available Time</label>
<View>
<View>
<i class="fa-regular fa-clock"></i>
</View>
<select class="block w-full pl-10 pr-10 py-2.5 bg-[#131313] border border-gray-700 rounded-xl text-white text-sm focus:ring-[#5c77ff] focus:border-[#5c77ff] appearance-none">
<option>Full Day (8 hrs)</option>
<option>Half Day (4 hrs)</option>
<option>Evening (3 hrs)</option>
</select>
<View>
<i class="fa-solid fa-chevron-down text-xs"></i>
</View>
</View>
</View>
</View>
</section>
<!-- END: PreferencesSection -->
<!-- BEGIN: PrimaryLocationSection -->
<section class="mb-6 parallax-container">
<View>
<i class="fa-solid fa-location-dot text-[#5c77ff]"></i>
<Text>Primary Location</Text>
</View>
<View>
<img alt="Gyeongbokgung Palace" class="parallax-bg w-full h-32 object-cover opacity-60" id="heroBg" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCfHMAwZOn2u5L5xJz6KxG7jNrWykyTNyg83DHXAWGU-tPFqabLFpJ7TdFQN2m77z6wOewDOkdMItU4wwzR3LDg_nvHYMbYiONej0Pye2OhqXG4t0-eibD0fSqDEpa8fANisjsMz5ja4YpXt5N8-BzD0qtBK3-i1K7YDGguKbjAZ8rMH0Qb6LcWOFbuZTyKFAXPTtijPpkUqXc1xixU1q3nwII8sFvJwcdCD1_RvSQZk6-bp4Xh-LeJhRLoQWOWWvWRbcXdCVSjow58">
<View></View>
<View>
<View>
<View>
<Text>Gyeongbokgung<br>Palace</Text>
<Text>The Heart of Old Seoul</Text>
</View>
<View>
<i class="fa-solid fa-check text-[#5c77ff] text-xs"></i>
</View>
</View>
</View>
</View>
</section>
<!-- END: PrimaryLocationSection -->
<!-- BEGIN: NearbyActivitiesSection -->
<section class="mb-8">
<View>
<i class="fa-solid fa-compass text-[#5c77ff]"></i>
<Text>Nearby Activities</Text>
</View>
<View>
<!-- Activity 1 -->
<label class="flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 transition-colors">
<View>
<View>
<i class="fa-solid fa-building-columns"></i>
</View>
<View>
<View>MMCA (Contemporary Art)</View>
<View>Modern Art &amp; Design</View>
</View>
</View>
<View>
<input class="sr-only" type="checkbox">
<View>
<svg class="checkmark-svg w-3 h-3 text-[#5c77ff]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><Text></path></svg>
</View>
</View>
</label>
<!-- Activity 2 -->
<label class="flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 transition-colors">
<View>
<View>
<i class="fa-solid fa-map-location-dot"></i>
</View>
<View>
<View>Gyeongbokgung (Detailed Tour)</View>
<View>Guided Palace History</View>
</View>
</View>
<View>
<input checked="" class="sr-only" type="checkbox">
<View>
<svg class="checkmark-svg w-3 h-3 text-[#5c77ff]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><Text></path></svg>
</View>
</View>
</label>
<!-- Activity 3 -->
<label class="flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 transition-colors">
<View>
<View>
<i class="fa-solid fa-book-open"></i>
</View>
<View>
<View>Kyobo Bookstore</View>
<View>Korea's Largest Bookstore</View>
</View>
</View>
<View>
<input class="sr-only" type="checkbox">
<View>
<svg class="checkmark-svg w-3 h-3 text-[#5c77ff]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><Text></path></svg>
</View>
</View>
</label>
<!-- Activity 4 -->
<label class="flex items-center justify-between p-3 bg-[#1a1a1a] border border-gray-800 rounded-xl cursor-pointer hover:border-gray-600 transition-colors">
<View>
<View>
<i class="fa-solid fa-house-chimney-window"></i>
</View>
<View>
<View>Bukchon Hanok Village</View>
<View>Traditional Korean Houses</View>
</View>
</View>
<View>
<input checked="" class="sr-only" type="checkbox">
<View>
<svg class="checkmark-svg w-3 h-3 text-[#5c77ff]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><Text></path></svg>
</View>
</View>
</label>
</View>
<TouchableOpacity>
<i class="fa-solid fa-wand-magic-sparkles"></i>
        Generate Itinerary
      </TouchableOpacity>
</section>
<!-- END: NearbyActivitiesSection -->
<hr class="border-gray-800 my-8">
<!-- BEGIN: GeneratedRouteSection -->
<section>
<View>
<View>
<View>
<Text>Generated<br>Route</Text>
<span class="bg-[#064e3b] text-[#34d399] border border-[#047857] text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider self-start mt-1">AI<br>Optimized</span>
</View>
<Text>Drag handles to reorder your<br>schedule.</Text>
</View>
<View>
<View>8 Hours</View>
<View>Estimated<br>Duration</View>
</View>
</View>
<View>
<View></View>
<View>
<!-- Stop 1 -->
<View>
<View>
              01
            </View>
<View>
<View>
<i class="fa-solid fa-grip-vertical"></i>
</View>
<View>
<View>
<Text>Gyeongbokgung<br>Palace</Text>
<View>09:00<br>AM</View>
</View>
<Text>Start your day exploring the largest of the Five...</Text>
<View>
<span class="text-[10px] bg-[#131313] border border-gray-700 px-2 py-1 rounded text-gray-300">2.5 hours</span>
<span class="text-[10px] bg-[#131313] border border-gray-700 px-2 py-1 rounded text-gray-300">Walking</span>
</View>
</View>
</View>
</View>
<!-- Stop 2 -->
<View>
<View>
              02
            </View>
<View>
<View>
<i class="fa-solid fa-grip-vertical"></i>
</View>
<View>
<View>
<Text>Bukchon Hanok<br>Village</Text>
<View>11:45<br>AM</View>
</View>
<Text>A short walk from the palace. Wander through...</Text>
<View>
<span class="text-[10px] bg-[#131313] border border-gray-700 px-2 py-1 rounded text-gray-300">1.5 hours</span>
<span class="text-[10px] bg-[#131313] border border-gray-700 px-2 py-1 rounded text-gray-300">Photography</span>
</View>
</View>
</View>
</View>
<!-- Lunch Break -->
<View>
<View>
<i class="fa-solid fa-utensils"></i>
</View>
<View>
<span class="text-sm text-gray-400">Lunch Break in<br>Insadong</span>
<span class="text-[10px] text-gray-500 text-right leading-tight">13:15<br>PM</span>
</View>
</View>
<!-- Stop 3 -->
<View>
<View>
              03
            </View>
<View>
<View>
<i class="fa-solid fa-grip-vertical"></i>
</View>
<View>
<View>
<Text>N Seoul Tower</Text>
<View>15:00 PM</View>
</View>
<Text>Head up Namsan Mountain for panoramic...</Text>
<View>
<span class="text-[10px] bg-[#131313] border border-gray-700 px-2 py-1 rounded text-gray-300">2 hours</span>
<span class="text-[10px] bg-[#131313] border border-gray-700 px-2 py-1 rounded text-gray-300">Scenic</span>
</View>
</View>
</View>
</View>
</View>
</View>
</section>
<!-- END: GeneratedRouteSection -->
</main>
<!-- END: MainContent -->
<!-- BEGIN: BottomActionArea -->
<View>
<View>
<TouchableOpacity>
        Save Draft
      </TouchableOpacity>
<TouchableOpacity>
        Finalize Plan
      </TouchableOpacity>
</View>
</View><nav class="fixed bottom-6 left-4 right-4 bg-[#1a1a1a]/90 backdrop-blur-md border border-gray-800 rounded-full flex justify-around items-center py-2 px-2 shadow-2xl z-[60]"><TouchableOpacity><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><Text></path></svg></TouchableOpacity><TouchableOpacity><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><Text></path></svg></TouchableOpacity><TouchableOpacity><svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><Text></path><Text></path></svg></TouchableOpacity></nav>
<!-- END: BottomActionArea -->
<script>
  // Parallax Logic
  const heroCard = document.getElementById('heroCard');
  const heroBg = document.getElementById('heroBg');

  if (heroCard && heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    heroCard.addEventListener('mousemove', (e) => {
      const rect = heroCard.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = (y - centerY) / 20;
      const rotateY = (centerX - x) / 20;
      
      // Card tilt
      heroCard.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
      
      // Subtle background shift (inverse direction)
      const moveX = (x - centerX) / 15;
      const moveY = (y - centerY) / 15;
      heroBg.style.transform = `scale(1.1) translate(${moveX}px, ${moveY}px)`;
    });

    heroCard.addEventListener('mouseleave', () => {
      heroCard.style.transform = 'rotateX(0deg) rotateY(0deg)';
      heroBg.style.transform = 'scale(1.1) translate(0, 0)';
    });

    // Device orientation support for mobile
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', (e) => {
        const tiltX = Math.min(Math.max(e.beta, -30), 30) / 3;
        const tiltY = Math.min(Math.max(e.gamma, -30), 30) / 3;
        
        heroCard.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
        heroBg.style.transform = `scale(1.1) translate(${tiltY * -1.5}px, ${tiltX * -1.5}px)`;
      });
    }
  }

  // Checkbox Drawing Interaction
  document.querySelectorAll('label input[type="checkbox"]').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const container = e.target.nextElementSibling;
      if (e.target.checked) {
        container.classList.add('border-[#5c77ff]');
        container.classList.remove('border-gray-700');
      } else {
        container.classList.remove('border-[#5c77ff]');
        container.classList.add('border-gray-700');
      }
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
