import re

with open('tests/unit/endless_generator.test.ts', 'r') as f:
    content = f.read()

new_content = content.replace('''        'crystalline nebulaRibbons airTokens asteroidField - 1090',
        'biological fossilizedSpaceWhales timeShiftZones lightning starEater 1120',
        'industrial hyperspaceTunnel windCurrents industrialGeometry - 990',
        'biological nebula airTokens asteroidField - 850',
        'industrial dynamicStarfield comboCorridor stormGeode kraken 1260',
        'crystalline galacticCore windCurrents asteroidField - 750',
        'biological godRays airTokens lightning zephyr 1200',
        'industrial industrial gravLens asteroidField - 790'
    ]);''', '''        'crystalline moonPalace airTokens asteroidField - 1090',
        'biological fossilizedSpaceWhales timeShiftZones lightning starEater 1120',
        'industrial galacticLeylines windCurrents industrialGeometry - 990',
        'biological nebula airTokens asteroidField - 850',
        'industrial orbitalMegastructures comboCorridor stormGeode kraken 1260',
        'crystalline nebulaRibbons windCurrents asteroidField - 750',
        'biological dynamicStarfield airTokens asteroidField - 730',
        'industrial industrial windCurrents stormGeode zephyr 1130'
    ]);''')

with open('tests/unit/endless_generator.test.ts', 'w') as f:
    f.write(new_content)
