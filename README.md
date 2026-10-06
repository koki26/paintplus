# PaintPlus

Jednoduchý kreslicí program pro Windows – jako Malování, ale s vrstvami, symetrií, filtry a spoustou dalšího.
Stáhnete, nainstalujete a funguje to hned. Žádné další závislosti.

## Instalace

1. Otevřete [Releases](../../releases/latest) a stáhněte `PaintPlus-Setup-x.y.z.exe`.
2. Spusťte instalátor. Nainstaluje se jedním klepnutím a vytvoří zástupce na ploše i v nabídce Start.

> Instalátor zatím není podepsaný certifikátem, takže Windows SmartScreen může zobrazit varování.
> Klepněte na **Další informace → Přesto spustit**.

## Co umí

**Kreslení**
- Štětec, tužka (ostré pixely), zvýrazňovač, sprej, kaligrafické pero, guma
- Podpora tabletu a pera včetně tlaku
- Symetrické kreslení (vodorovné, svislé, čtyřnásobné zrcadlo)
- Vyplňování s nastavitelnou tolerancí, přechody, kapátko
- Tvary: čára, šipka, obdélník, zaoblený obdélník, elipsa, trojúhelník, hvězda (Shift = přesné proporce)
- Text s výběrem písma, tučným písmem a kurzívou
- Nastavitelná průhlednost všech nástrojů

**Práce s obrázkem**
- Vrstvy (přidat, duplikovat, přejmenovat, skrýt, průhlednost, pořadí, sloučit)
- Výběr s přesouváním, kopírováním, vyjmutím, vložením a oříznutím
- Neomezené zpět/vpřed
- Filtry: černobílý, negativ, sépie, jas, kontrast, sytost, odstín, rozostření, pixelizace
- Otočení, překlopení, změna velikosti a plátna
- Přiblížení až 3200 %, pixelová mřížka, posun mezerníkem

**Soubory**
- Otevření a uložení PNG, JPG, WebP
- Vložení obrázku ze schránky nebo přetažením do okna
- Kopírování celého obrázku do schránky
- Obrázky lze otevírat i přes „Otevřít v programu“ (PNG, JPG, BMP, GIF, WebP)

## Klávesové zkratky

| Klávesa | Akce | Klávesa | Akce |
|---|---|---|---|
| `B` | Štětec | `Ctrl+Z` / `Ctrl+Y` | Zpět / Vpřed |
| `P` | Tužka | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` | Nový / Otevřít / Uložit |
| `E` | Guma | `Ctrl+C` / `Ctrl+X` / `Ctrl+V` | Kopírovat / Vyjmout / Vložit |
| `G` | Vyplnit | `Ctrl+A` | Vybrat vše |
| `I` | Kapátko | `X` | Prohodit barvy |
| `T` | Text | `[` `]` | Velikost štětce |
| `L` `R` `O` | Čára, obdélník, elipsa | `Mezerník` + tažení | Posun plátna |
| `S` | Výběr | `Ctrl` + kolečko | Zoom |

Pravé tlačítko myši kreslí sekundární barvou. `Alt` + klik je kapátko v každém nástroji. `F1` zobrazí všechny zkratky.

## Vývoj

Potřebujete [Node.js](https://nodejs.org) 20 nebo novější.

```bash
npm install
npm start          # spuštění aplikace
npm run dist       # sestavení instalátoru do složky dist/
```

Aplikace je napsaná v Electronu bez dalších frameworků. Zdrojový kód je v `src/` (`app.js` je celé jádro editoru).

Nové vydání se sestaví automaticky: stačí vytvořit tag `vX.Y.Z` a GitHub Actions nahrají instalátor do Releases.

## Licence

[MIT](LICENSE)
