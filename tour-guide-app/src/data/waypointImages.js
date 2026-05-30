const waypointImages = {
  main_gate: require('../../assets/images/waypoints/main_gate.jpg'),
  ticket_booth: require('../../assets/images/waypoints/main_gate.jpg'),
  heungnyemun: require('../../assets/images/waypoints/main_gate.jpg'),
  geunjeongjeon: require('../../assets/images/waypoints/geunjeongjeon.jpg'),
  gyeonghoeru: require('../../assets/images/waypoints/gyeonghoeru.jpg'),
  national_palace_museum: require('../../assets/images/hotspots/h_006_palace_museum_1778862402556.png'),
  sajeongjeon: require('../../assets/images/waypoints/sajeongjeon.jpg'),
  gangnyeongjeon: require('../../assets/images/waypoints/royal_residences.jpg'),
  gyotaejeon: require('../../assets/images/waypoints/royal_residences.jpg'),
  amisan: require('../../assets/images/waypoints/amisan.jpg'),
  hyangwonjeong: require('../../assets/images/waypoints/hyangwonjeong.jpg'),
  national_folk_museum: require('../../assets/images/waypoints/national_folk_museum.jpg'),
  sinmumun: require('../../assets/images/waypoints/palace_gate.jpg'),
  yeonchumun: require('../../assets/images/waypoints/palace_gate.jpg'),
  geonchunmun: require('../../assets/images/waypoints/palace_gate.jpg'),
  sejong_statue: require('../../assets/images/waypoints/gwanghwamun_square.jpg'),
  yi_sun_sin_statue: require('../../assets/images/waypoints/gwanghwamun_square.jpg'),
  gwanghwamun_station_9: require('../../assets/images/waypoints/gwanghwamun_square.jpg'),
  sejong_center: require('../../assets/images/waypoints/gwanghwamun_square.jpg'),
  cheonggyecheon_plaza: require('../../assets/images/waypoints/cheonggyecheon_plaza.jpg'),
};

const fallbackWaypointImage = require('../../assets/images/hotspots/palace_history_1778862119711.png');

export const getWaypointImage = (waypointId) =>
  waypointImages[waypointId] || fallbackWaypointImage;

export default waypointImages;
