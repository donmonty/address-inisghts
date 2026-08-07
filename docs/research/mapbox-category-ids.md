# Mapbox canonical category IDs

Pulled live from `GET https://api.mapbox.com/search/searchbox/v1/list/category` on 2026-08-07 (via the Mapbox MCP `category_list_tool`, `language=en`). Resolves [Pin the real canonical Mapbox category IDs](https://github.com/donmonty/address-inisghts/issues/3).

## The twelve we query

These are **verbatim** strings from the live list. No guesses.

| Tier | Category ID | Notes |
| --- | --- | --- |
| Essential | `grocery` | Parent of `supermarket`. Spot-checked in Manhattan: H Mart, K Village, Hashi Market. |
| Essential | `pharmacy` | |
| Essential | `public_transportation_station` | **The single transit ID.** Bus stops carry it alone; subway stops carry it *plus* `light_rail_station` + `railway_station`. Covers all modes without adding IDs. |
| Essential | `school` | Parent of `elementary_school`, `high_school`, `kindergarten`. |
| Useful | `restaurant` | Parent of the cuisine leaves (`italian_restaurant`, `thai_restaurant`, …). |
| Useful | `cafe` | Not `café`. Related leaves `coffee_shop` / `coffee` / `teahouse` are deliberately excluded. |
| Useful | `park` | |
| Useful | `bank` | Not `financial_services` (too broad) and not `atm` (too granular). |
| Amenity | `bar` | Not `nightlife` (parent, drags in clubs/casinos) and not `pub` (regional). |
| Amenity | `fitness_center` | **The real ID for "gym".** `gym` does not exist as a top-level ID; the display label on `fitness_center` is literally "gym". Spot-checked in Plano TX. |
| Amenity | `clothing_store` | The retail signal. Spot-checked in Plano TX. Human decision — see below. |
| Amenity | `library` | |

### IDs that were guesses and turned out wrong

- **`gym`** → does not exist. Use `fitness_center`.
- **`transit`** → does not exist. Use `public_transportation_station`.
- **`shopping`** → exists, but is **disqualified** (see below). Use a leaf; we chose `clothing_store`.

`grocery`, `park`, `pharmacy`, `school`, `bank`, and `library` were guesses that happened to be correct — now confirmed against the live list.

## Hierarchy is the trap

`poi_category_ids` is multi-valued and hierarchical. A single POI arrives tagged with its leaf *and* every ancestor:

- H Mart → `["grocery", "shopping"]`
- A Koreatown subway entrance → `["light_rail_station", "public_transportation_station", "railway_station", "transportation"]`
- A Plano yoga studio → `["fitness_center", "services", "sports", "yoga_studio"]`

**No ID in the chosen twelve is an ancestor of another** — that invariant is what keeps the category set from double-counting itself.

Top-level parents deliberately excluded for exactly this reason:

| Excluded | Why |
| --- | --- |
| `shopping` | Rides on every grocery *and* every clothing store — would double-count both. |
| `food_and_drink`, `food` | Overlap `restaurant`, `cafe`, `bar`. |
| `transportation` | Superset of `public_transportation_station`; includes gas stations and parking lots. |
| `services`, `health_services`, `education`, `sports`, `outdoors`, `entertainment`, `nightlife` | Broad parents that would collide with chosen leaves. |

Dedupe by `mapbox_id` before computing POI density remains load-bearing — the same café still arrives under both `restaurant` and `cafe`.

## The one human decision

Eleven slots were forced by which strings actually exist. The twelfth — the amenity-tier "shopping" signal — was a real choice between `clothing_store`, `convenience_store`, `shopping_mall`, and `department_store`.

**Chosen: `clothing_store`.** It reads as walkable high-street retail and exists in both urban and suburban centres. `shopping_mall` and `department_store` are too sparse to differentiate (most addresses return zero); `convenience_store` is a daily-needs signal that belongs in the essential tier and overlaps `grocery` conceptually.

## Full category list (as returned, in API order)

<details>
<summary>All canonical category IDs — 2026-08-07</summary>

```
services shopping food_and_drink food restaurant office health_services education
apartment_or_condo grocery transportation place_of_worship clothing_store outdoors salon
lodging supermarket wholesale_store auto_repair financial_services school beauty_store
government cafe bus_stop fast_food hairdresser park real_estate_agent pharmacy nightlife
hotel sports bank temple tourist_attraction medical_practice bar chinese_restaurant church
doctors_office coffee_shop coffee bakery farm medical_clinic home hospital fitness_center
commercial factory furniture_store convenience_store entertainment car_dealership dentist
repair_shop consulting electronics_shop hospital_unit parking_lot lawyer shopping_mall
shipping_store photographer mosque elementary_school clothing gas_station atm market
hardware_store travel_agency historic_site phone_store advertising_agency dessert_shop
alternative_healthcare insurance_broker post_office kindergarten shoe_store jewelry_store
monument it warehouse mountain river laundry playground car_wash psychotherapist gift_shop
lake pet_store spa nongovernmental_organization ice_cream japanese_restaurant sports_club
massage_shop florist garden butcher_shop tailor bed_and_breakfast physiotherapist teahouse
field womens_clothing_store care_services cemetery charging_station car_rental
paper_goods_store book_store photo_store psychological_services pizza_restaurant
internet_cafe college nail_salon community_center copyshop korean_restaurant landscaping
chiropractor tobacco_shop liquor_store hostel event_planner asian_restaurant veterinarian
design_studio childcare employment_agency public_transportation_station university
event_space optician home_repair assisted_living_facility social_club medical_supply_store
studio bridge taxi museum sports_shop art buddhist_temple bicycle_shop snack_bar
health_food_store high_school motorcycle_dealer police_station equipment_rental
arts_and_craft_store tutor medical_laboratory driving_school tattoo_parlour boutique deli
food_court mexican_restaurant nightclub library tax_advisor indian_restaurant
fashion_accessory_shop fabric_store burger_restaurant dance_studio language_school forest
dry_cleaners department_store island barbeque_restaurant storage news_kiosk mattress_store
counselling seafood_restaurant soccer_field funeral_home video_game_store
breakfast_restaurant diner_restaurant noodle_restaurant fire_station music_school
art_gallery brunch_restaurant juice_bar toy_store baby_goods_shop karaoke_bar yoga_studio
government_offices recording_studio fishing_store bus_station italian_restaurant
conference_center indonesian_restaurant townhall swimming_pool furniture_maker theme_park
lighting_store pub theatre notary sushi_restaurant university_building stadium
recycling_center charity winery laboratory dormitory music_shop motel antique_shop cinema
golf_course music_venue nature_reserve public_artwork outdoor_sculpture american_restaurant
railway_station pawnshop garden_store discount_store waste_transfer_station sandwich_shop
watch_store lounge taco_shop rehabilitation_center labor_union party_store
tourist_information tennis_courts radio_studio rest_area thrift_shop pilates_studio
buffet_restaurant locksmith vape_shop bridal_shop canal thai_restaurant leather_goods
casino psychic video_store coworking_space recreation_center kitchen_store
martial_arts_studio courthouse boat_rental campground brewery basketball_court cobbler
vacation_rental cocktail_bar outlet_store sewing_shop shoe_repair arts_center bubble_tea
billiards trade_school airport gymnastics ramen_restaurant fair_grounds concert_hall beach
herbalist french_restaurant hobby_shop donut_shop steakhouse tanning_salon currency_exchange
camera_shop viewpoint television_studio cannabis_dispensary frame_store animal_shelter
stable carpet_store tours wine_bar optometrist baseball_field tapas_restaurant
vietnamese_restaurant marina turkish_restaurant spanish_restaurant photo_lab cheese_shop
gun_store waste_disposal pier sauna middle_eastern_restaurant beer_bar emergency_room
gastropub sports_bar dog_park picnic_shelter fish_and_chips_restaurant sports_center
african_restaurant military_office hookah_lounge fireworks_store coffee_roaster vineyard
synagogue greek_restaurant zoo luggage_store hunting_store dam boxing_gym community_college
mediterranean_restaurant prison salad_bar racetrack bookmaker hot_dog_stand bowling_alley
fishmonger dialysis_center light_rail_station climbing climbing_gym aquarium fishing
brazilian_restaurant exhibit waterfall military_base bagel_shop korean_barbeque_restaurant
motorsports_store frozen_yogurt_shop cricket_club summer_camp embassy ski_area ice_rink
filipino_restaurant carribean_restaurant surfboard_store german_restaurant distillery resort
biergarten check_cashing plaza treecare hunting_area gay_bar disc_golf_course miniature_golf
observatory cable_car town cave hawaiian_restaurant duty_free_shop portuguese_restaurant
latin_american_restaurant fountain persian_restaurant skydiving_drop_zone creole_restaurant
cuban_restaurant english_restaurant rugby_stadium gluten_free_restaurant train
airport_terminal trailhead tiki_bar intersection street information_technology_company
food_truck boat_or_ferry bike_rental veterans_service peruvian_restaurant arcade wings_joint
chocolate_shop soccer_stadium outdoors_store water_park irish_pub windmill service_area
surf_spot skatepark football_stadium track cruise baseball_stadium theme_park_attraction
carpet_cleaner mountain_hut ski_shop lighthouse go_kart_racing tech_startup tunnel
airport_gate political_party_office beach_bar dive_bar basketball_stadium laser_tag
driving_range scuba_diving_shop ski_trail states_and_municipalities stripclub well
racecourse waffle_shop boat_launch university_laboratory corporate_amenity neighbourhood
planetarium speakeasy tennis_stadium tree meeting_room rafting_spot university_book_store
zoo_exhibit champagne_bar indoor_cycling turkish_coffeehouse village baggage_claim chairlift
sake_bar airport_ticket_counter beer_festival bus_line city country county graffiti
hotel_bar lgbtq_organization moving_target pop_up_shop railway_platform road state
variety_store whiskey_bar
```

</details>
