const bank = {
  'General Knowledge': [
    ['Which is the largest ocean on Earth?', ['Atlantic Ocean', 'Indian Ocean', 'Pacific Ocean', 'Arctic Ocean'], 2],
    ['Which city is the capital of Japan?', ['Kyoto', 'Osaka', 'Tokyo', 'Sapporo'], 2],
    ['How many sides does a hexagon have?', ['Five', 'Six', 'Seven', 'Eight'], 1],
    ['Which is the smallest continent by land area?', ['Europe', 'Antarctica', 'South America', 'Australia'], 3],
    ['What is the currency of the United Kingdom?', ['Euro', 'Pound sterling', 'Franc', 'Krone'], 1],
    ['Which language has the most native speakers worldwide?', ['English', 'Spanish', 'Mandarin Chinese', 'Hindi'], 2],
    ['What is the tallest mountain above sea level?', ['K2', 'Kangchenjunga', 'Denali', 'Mount Everest'], 3],
    ['Which country is home to the ancient city of Petra?', ['Egypt', 'Jordan', 'Greece', 'Turkey'], 1],
    ['How many colors are traditionally named in a rainbow?', ['Five', 'Six', 'Seven', 'Eight'], 2],
    ['What is the largest mammal on Earth?', ['African elephant', 'Blue whale', 'Giraffe', 'Whale shark'], 1]
  ],
  Science: [
    ['What is the chemical symbol for gold?', ['Ag', 'Au', 'Gd', 'Go'], 1],
    ['Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1],
    ['What gas do plants absorb from the atmosphere?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2],
    ['What is the largest organ of the human body?', ['Liver', 'Brain', 'Skin', 'Lung'], 2],
    ['How many bones are in a typical adult human body?', ['186', '206', '226', '246'], 1],
    ['What is the center of an atom called?', ['Electron', 'Molecule', 'Nucleus', 'Proton'], 2],
    ['Which part of a plant usually absorbs water from soil?', ['Leaf', 'Stem', 'Flower', 'Root'], 3],
    ['What is the nearest star to Earth?', ['Sirius', 'The Sun', 'Proxima Centauri', 'Vega'], 1],
    ['At sea level, water boils at what temperature in Celsius?', ['0°', '50°', '100°', '150°'], 2],
    ['Which blood cells help the body fight infection?', ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma cells'], 1]
  ],
  Technology: [
    ['What does “CPU” stand for?', ['Central Processing Unit', 'Computer Power Utility', 'Core Program Unit', 'Central Program User'], 0],
    ['Which two digits are used in binary code?', ['0 and 1', '1 and 2', '0 and 9', '2 and 8'], 0],
    ['What does URL stand for?', ['Universal Reading Link', 'Uniform Resource Locator', 'United Routing Language', 'User Reference List'], 1],
    ['Which company created the Android operating system?', ['Apple', 'Microsoft', 'Google', 'IBM'], 2],
    ['What does “Wi-Fi” let devices do?', ['Connect wirelessly to a network', 'Print without ink', 'Charge without a cable', 'Store files permanently'], 0],
    ['Which is an example of a web browser?', ['Linux', 'Firefox', 'Python', 'Bluetooth'], 1],
    ['What does “HTML” describe?', ['A type of hard drive', 'A web page markup language', 'A computer virus', 'A wireless standard'], 1],
    ['Which device converts digital signals for a traditional internet connection?', ['Modem', 'Projector', 'Scanner', 'Stylus'], 0],
    ['What is the common name for a small picture representing an app?', ['Pixel', 'Icon', 'Widget', 'Cursor'], 1],
    ['Which company makes the PlayStation console?', ['Nintendo', 'Sega', 'Sony', 'Valve'], 2]
  ],
  Sports: [
    ['How many players from one team are on court in basketball?', ['4', '5', '6', '7'], 1],
    ['How many rings appear on the Olympic symbol?', ['Four', 'Five', 'Six', 'Seven'], 1],
    ['In soccer, what is it called when a player scores three goals in a match?', ['Hat-trick', 'Triple play', 'Grand slam', 'Clean sweep'], 0],
    ['How many holes are played in a standard round of golf?', ['9', '12', '18', '21'], 2],
    ['Which sport uses a shuttlecock?', ['Squash', 'Badminton', 'Table tennis', 'Lacrosse'], 1],
    ['In tennis, what score comes after deuce when a player wins the next point?', ['Love', 'Advantage', 'Set point', 'Break'], 1],
    ['How long is a regulation soccer match, excluding stoppage time?', ['60 minutes', '80 minutes', '90 minutes', '100 minutes'], 2],
    ['Which sport is associated with the Tour de France?', ['Running', 'Cycling', 'Sailing', 'Motorsport'], 1],
    ['What is the official distance of a marathon, rounded to the nearest kilometer?', ['32 km', '38 km', '42 km', '48 km'], 2],
    ['In baseball, how many strikes usually make an out?', ['Two', 'Three', 'Four', 'Five'], 1]
  ],
  Movies: [
    ['What is the name of the kingdom in Frozen?', ['Genovia', 'Arendelle', 'Narnia', 'Corona'], 1],
    ['Which toy is a space ranger in Toy Story?', ['Woody', 'Slinky', 'Buzz Lightyear', 'Rex'], 2],
    ['What is the name of the school Harry Potter attends?', ['Beauxbatons', 'Hogwarts', 'Durmstrang', 'Ilvermorny'], 1],
    ['In Finding Nemo, what kind of fish is Nemo?', ['Clownfish', 'Blue tang', 'Pufferfish', 'Angelfish'], 0],
    ['Which movie features the song “Let It Go”?', ['Moana', 'Tangled', 'Frozen', 'Encanto'], 2],
    ['What is the name of the kingdom in The Lion King?', ['Pride Lands', 'Neverland', 'Far Far Away', 'Middle-earth'], 0],
    ['Who is the friendly ogre in the film series of the same name?', ['Hagrid', 'Shrek', 'Sulley', 'Grinch'], 1],
    ['Which superhero is also known as the Dark Knight?', ['Superman', 'Spider-Man', 'Batman', 'Iron Man'], 2],
    ['What is the name of the snowman in Frozen?', ['Sven', 'Olaf', 'Kristoff', 'Marshmallow'], 1],
    ['Which film series features a ring that must be destroyed in Mordor?', ['Harry Potter', 'The Lord of the Rings', 'Star Wars', 'The Hobbit: An Unexpected Journey'], 1]
  ],
  'Logical Reasoning': [
    ['What number comes next: 2, 4, 8, 16, …?', ['20', '24', '30', '32'], 3],
    ['What number comes next: 3, 6, 9, 12, …?', ['13', '14', '15', '18'], 2],
    ['If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops Lazzies?', ['Yes', 'No', 'Only some', 'Cannot be determined'], 0],
    ['Which word does not belong: apple, pear, carrot, plum?', ['Apple', 'Pear', 'Carrot', 'Plum'], 2],
    ['A clock shows 3:00. What is the angle between its hands?', ['45°', '60°', '90°', '180°'], 2],
    ['If yesterday was Monday, what day is tomorrow?', ['Tuesday', 'Wednesday', 'Thursday', 'Sunday'], 1],
    ['What number is missing: 1, 1, 2, 3, 5, …?', ['6', '7', '8', '10'], 2],
    ['A dozen eggs is 12. How many eggs are in two dozen?', ['18', '20', '24', '36'], 2],
    ['If you overtake the runner in second place, what place are you in?', ['First', 'Second', 'Third', 'Fourth'], 1],
    ['Which shape comes next: circle, square, circle, square, …?', ['Triangle', 'Circle', 'Pentagon', 'Oval'], 1]
  ]
};

export const CATEGORIES = Object.keys(bank);
export const QUESTIONS = Object.entries(bank).flatMap(([category, entries]) => entries.map(([prompt, choices, answer]) => ({ category, prompt, choices, answer })));
export const PUBLIC_QUESTIONS = QUESTIONS.map(({ answer, ...question }) => question);
