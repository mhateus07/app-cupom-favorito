const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * O Xcode 27 recusa targets com versão mínima de iOS abaixo de 15. Algumas libs (ex.: o
 * bundle RNSVGFilters do react-native-svg) ainda declaram 12.4; aqui elevamos todos os
 * pods para a versão mínima do app.
 */
const MARCADOR = '# withPodsDeploymentTarget';

module.exports = function withPodsDeploymentTarget(config, { minimo = '15.1' } = {}) {
  return withDangerousMod(config, [
    'ios',
    async cfg => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let conteudo = fs.readFileSync(podfile, 'utf8');
      if (!conteudo.includes(MARCADOR)) {
        conteudo = conteudo.replace(
          /post_install do \|installer\|\n/,
          match =>
            `${match}    ${MARCADOR}\n` +
            `    installer.pods_project.targets.each do |target|\n` +
            `      target.build_configurations.each do |bc|\n` +
            `        atual = bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET']\n` +
            `        if atual.nil? || Gem::Version.new(atual) < Gem::Version.new('${minimo}')\n` +
            `          bc.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${minimo}'\n` +
            `        end\n` +
            `      end\n` +
            `    end\n`
        );
        fs.writeFileSync(podfile, conteudo);
      }
      return cfg;
    },
  ]);
};
