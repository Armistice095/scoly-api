import { genererEmailCode } from './verification-code.template.js';
import { genererEmailInvitation } from './invitation.template.js';
import { echapperHtml } from './mise-en-page.js';

describe('genererEmailCode — activation', () => {
  const email = genererEmailCode('482913', 'activation');

  it('met le code dans l’objet (lisible dans la notification)', () => {
    expect(email.sujet).toBe('482913 est votre code de vérification Scoly');
  });

  it('texte brut : le message validé, mot pour mot', () => {
    expect(email.texte).toBe(
      [
        'Bonjour,',
        '',
        'Nous vous remercions d’avoir choisi Scoly.',
        'Pour finaliser l’activation de votre compte établissement, veuillez saisir le code de vérification ci-dessous :',
        '',
        '482913',
        '',
        'Ce code est valable pendant 10 minutes. Pour votre sécurité, ne le communiquez jamais à qui que ce soit, y compris à une personne se présentant comme l’équipe Scoly.',
        '',
        'Si vous n’êtes pas à l’origine de cette demande, vous pouvez simplement ignorer cet e-mail.',
        '',
        'À bientôt sur Scoly,',
        'L’équipe Scoly',
      ].join('\n'),
    );
  });

  it('HTML : contient le code d’un seul bloc et les mêmes phrases', () => {
    expect(email.html).toContain('>482913</span>');
    expect(email.html).toContain('Nous vous remercions d’avoir choisi Scoly.');
    expect(email.html).toContain('valable pendant 10 minutes');
    expect(email.html).toContain('lang="fr"');
  });
});

describe('genererEmailCode — réinitialisation du mot de passe', () => {
  const email = genererEmailCode('120045', 'reset_mot_de_passe');

  it('objet dédié', () => {
    expect(email.sujet).toBe('120045 : réinitialisez votre mot de passe Scoly');
  });

  it('texte brut : le message validé, mot pour mot', () => {
    expect(email.texte).toBe(
      [
        'Bonjour,',
        '',
        'Une demande de réinitialisation du mot de passe de votre compte Scoly a été effectuée.',
        'Pour continuer, veuillez saisir le code de vérification ci-dessous :',
        '',
        '120045',
        '',
        'Ce code est valable pendant 10 minutes. Pour votre sécurité, ne le communiquez à personne.',
        '',
        'Si vous n’êtes pas à l’origine de cette demande, aucune action n’est requise de votre part. Vous pouvez simplement ignorer cet e-mail.',
        '',
        'À bientôt sur Scoly,',
        'L’équipe Scoly',
      ].join('\n'),
    );
  });

  it('ne parle pas d’activation ni de remerciement d’inscription', () => {
    expect(email.html).not.toMatch(/activation|choisi Scoly/);
    expect(email.texte).not.toMatch(/activation|choisi Scoly/);
  });
});

describe.each(['activation', 'reset_mot_de_passe'] as const)(
  'genererEmailCode — %s : sécurité',
  (contexte) => {
    const { html, texte } = genererEmailCode('000111', contexte);

    it('ne contient aucun lien (anti-hameçonnage)', () => {
      expect(html).not.toMatch(/<a\s/i);
      expect(html).not.toContain('href');
      expect(texte).not.toMatch(/https?:/);
    });

    it('n’utilise ni image ni ressource externe', () => {
      expect(html).not.toMatch(/<img|<link|<script|url\(/i);
    });
  },
);

describe('echapperHtml', () => {
  it('neutralise les caractères HTML', () => {
    expect(echapperHtml(`<b onclick="x">R&D's</b>`)).toBe(
      '&lt;b onclick=&quot;x&quot;&gt;R&amp;D&#39;s&lt;/b&gt;',
    );
  });
});

describe('genererEmailInvitation', () => {
  const LIEN = 'https://scoly.app/invitation?id=abc&token=xyz';
  const email = genererEmailInvitation(LIEN, 'CEG Godomey', 'Secrétaire');

  it('objet', () => {
    expect(email.sujet).toBe('Invitation à rejoindre CEG Godomey sur Scoly');
  });

  it('texte brut : le message validé, avec le lien en clair', () => {
    expect(email.texte).toBe(
      [
        'Bonjour,',
        '',
        'Vous êtes invité(e) à rejoindre CEG Godomey sur Scoly.',
        'Le Directeur de votre établissement vous a invité(e) à rejoindre son espace Scoly en tant que Secrétaire.',
        'Scoly vous permettra d’accéder à l’espace de votre établissement et d’utiliser les fonctionnalités qui vous sont attribuées selon votre rôle.',
        '',
        'Votre compte est presque prêt',
        'Pour commencer, il vous suffit de créer votre mot de passe et d’activer votre compte en cliquant sur le lien ci-dessous :',
        '',
        LIEN,
        '',
        'Important : ce lien d’activation est valable pendant 7 jours. Passé ce délai, vous devrez demander au Directeur de votre établissement de vous envoyer une nouvelle invitation.',
        '',
        'Si vous n’êtes pas à l’origine de cette demande ou si vous ne reconnaissez pas cet établissement, vous pouvez simplement ignorer cet e-mail. Aucun compte ne sera activé sans votre action.',
        '',
        'Bienvenue sur Scoly,',
        'L’équipe Scoly',
      ].join('\n'),
    );
  });

  it('HTML : bouton cliquable + lien de secours, nom et fonction mis en avant', () => {
    expect(email.html).toContain(
      'Créer mon mot de passe et activer mon compte',
    );
    // « & » du lien correctement écrit en HTML, deux fois (bouton + lien de secours).
    expect(
      email.html.match(
        /href="https:\/\/scoly\.app\/invitation\?id=abc&amp;token=xyz"/g,
      ),
    ).toHaveLength(2);
    expect(email.html).toContain('>CEG Godomey</strong>');
    expect(email.html).toContain('>Secrétaire</strong>');
    expect(email.html).toContain('valable pendant 7 jours');
  });
});

describe('genererEmailInvitation — valeurs saisies par des utilisateurs', () => {
  it('échappe le nom d’établissement, la fonction et le lien dans le HTML', () => {
    const { html, texte, sujet } = genererEmailInvitation(
      'https://scoly.app/invitation?jeton=abc&x="><script>1</script>',
      '<img src=x onerror=alert(1)>CEG',
      '<script>alert(1)</script>',
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;CEG');
    // Texte brut et objet ne sont pas du HTML : valeurs d'origine conservées.
    expect(texte).toContain('<script>alert(1)</script>');
    expect(sujet).toContain('<img src=x onerror=alert(1)>CEG');
  });
});
