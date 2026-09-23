import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useTheme } from '@/theme';

const LONGUEUR = 6;

type Props = {
  onChange: (code: string) => void;
  /** Les 6 chiffres sont réunis : vérifie le code sans qu'il soit nécessaire de toucher un bouton. */
  onComplete: (code: string) => void;
  erreur: boolean;
  desactive: boolean;
};

function chiffresSeuls(saisie: string) {
  return saisie.replace(/\D/g, '');
}

/**
 * Le code à 6 chiffres reçu par SMS, une case par chiffre. Coller ou faire remplir
 * automatiquement le code complet dans une case le répartit sur les 6.
 *
 * Non contrôlé (pas de prop `value`) : pour remettre les cases à zéro (nouveau code
 * envoyé), le composant appelant change sa `key`.
 */
export function ChampCode({ onChange, onComplete, erreur, desactive }: Props) {
  const theme = useTheme();
  const [chiffres, setChiffres] = useState<string[]>(Array(LONGUEUR).fill(''));
  const refs = useRef<Array<TextInput | null>>([]);

  function annoncer(suite: string[]) {
    onChange(suite.join(''));
    if (suite.every((c) => c !== '')) onComplete(suite.join(''));
  }

  function ecrire(saisie: string, index: number) {
    const propres = chiffresSeuls(saisie);
    if (propres.length > 1) {
      // Collage ou remplissage automatique du code entier, arrivé dans une seule case.
      const recues = propres.slice(0, LONGUEUR).split('');
      const suite = Array.from({ length: LONGUEUR }, (_, i) => recues[i] ?? '');
      setChiffres(suite);
      if (recues.length >= LONGUEUR) refs.current[LONGUEUR - 1]?.blur();
      else refs.current[recues.length]?.focus();
      annoncer(suite);
      return;
    }
    const suite = [...chiffres];
    suite[index] = propres;
    setChiffres(suite);
    if (propres && index < LONGUEUR - 1) refs.current[index + 1]?.focus();
    annoncer(suite);
  }

  function surTouche(touche: string, index: number) {
    // Case vide et retour arrière : revenir corriger la précédente, comme sur un vrai clavier de code.
    if (touche === 'Backspace' && chiffres[index] === '' && index > 0) {
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.conteneur}>
      {chiffres.map((valeur, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            refs.current[index] = ref;
          }}
          accessibilityLabel={`Chiffre ${index + 1} sur ${LONGUEUR}`}
          style={[
            styles.case,
            {
              borderColor: erreur ? theme.erreur : theme.bordure,
              backgroundColor: theme.carte,
              color: theme.texte,
            },
          ]}
          keyboardType="number-pad"
          // Seule la première case porte l'indice qui déclenche le remplissage automatique du
          // téléphone (sinon il proposerait de le faire sur les 6, une par une).
          textContentType={index === 0 ? 'oneTimeCode' : undefined}
          maxLength={LONGUEUR}
          autoFocus={index === 0}
          editable={!desactive}
          value={valeur}
          onChangeText={(saisie) => ecrire(saisie, index)}
          onKeyPress={(e) => surTouche(e.nativeEvent.key, index)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  case: {
    flex: 1,
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
});
