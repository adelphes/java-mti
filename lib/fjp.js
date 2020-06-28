/*
* FJP is a fast, syntax-perfect Java parser used to map a Java source file to an JSON object
* It performs no validation beyond the absolute basic Java syntax structure and will immediately fail at any syntax error.
* It ignores all comments, method bodies and annotations, returning an object structure with types and declarations
*/
class FJP {
    // helper method to generate a typename structure for a specialised Enum<E> - the superclass of enum types
    static get_enum_superclass_typename(enumtype) {
        // the structure must match the typename() function
        return {
          simplename:'java.lang.Enum',
          genparams:[{simplename:enumtype.fqtn}],
        }
    }

    static java_to_json(source, filename) {
        let lastdecl;

        function error(e) {
            console.log(`Parse error in ${filename}. last decl...`);
            console.log(lastdecl);
            console.trace(e);
            throw new Error(e);
        }
        function stripwsc(o) {
            o.lastmlc = '';
            for (;;) {
                let m = o.source.match(/^(\s*\/\/.*)*\s*(\/\*|@\s*(?!interface\b))?/);    // ws followed by optional start of mlc or attribute
                switch (m[2] && m[2][0]) {
                    case '/':
                    // start of mlc - look for end
                    const mlcend = o.source.indexOf('*/', m[0].length);
                    if (mlcend < 0) error('Unterminated comment');
                    o.lastmlc = o.source.slice(m.index+m[0].length-2, mlcend+2);
                    o.source = o.source.slice(mlcend+2);
                    continue;
                    case '@':
                    // start of attribute
                    o.source = o.source.slice(m[0].length);
                    const attrname = dottedident(o);
                    //console.log('skipping ano: %s', attrname);
                    if (symbol(o,'(',true)) {
                        // just look for the end bracket, allowing for () in expressions
                        const re = /[()]/g;
                        let balance = 1;  // when the balance reaches 0, we're done
                        while(balance) {
                            (m=re.exec(o.source))[0]==='('?balance++:balance--;
                        }
                        o.source = o.source.slice(m.index+1);
                    }
                    continue;
                }
                o.source = o.source.slice(m[0].length);
                return;
            }
        }
        function ignoresc(o) {
            let i = 0;
            while (/^;/.test(o.source)) {
                o.source = o.source.slice(1);
                stripwsc(o);
                i++;
            }
            return i>0;
        }
        function has_text(o, kw) {
            if (o.source.slice(0,kw.length)===kw && !/[a-zA-Z0-9_]/.test(o.source[kw.length])) {
                o.source = o.source.slice(kw.length);
                stripwsc(o);
                return true;
            }
            return false;
        }
        function regex(o,re,s,optional) {
            const m = o.source.match(re);
            if (!m || m.index>0) {
                if (!optional) error('Missing '+s);
                return;
            }
            o.source = o.source.slice(m[0].length);
            stripwsc(o);
            return m;
        }
        function symbol(o,s,optional) {
            if (o.source.slice(0,s.length)!==s) {
               if (!optional) error('Missing '+s);
               return false;
            }
            o.source = o.source.slice(s.length);
            stripwsc(o);
            return true;
        }
        function constant_expression(o) {
            let exp;
            if (symbol(o, '(', true)) {
                const ce = constant_expression(o);
                symbol(o, ')')
                exp = '('+ce+')';
                if (/^[(\w]/.test(o.source)) {
                    return exp + constant_expression(o);
                }
            } else if (/^new\s*/.test(o.source)) {
                const m = o.source.match(/^new\s*[a-zA-Z_][\w]*(\s*\.\s*[a-zA-Z_]\w*)*/);
                o.source = o.source.slice(m[0].length); stripwsc(o);
                exp = m[0];
                while (symbol(o, '[', true)) {
                    let idx = '';
                    if (!symbol(o, ']', true)) {
                        idx = constant_expression(o);
                        symbol(o, ']');
                    }
                    exp = `${exp}[${idx}]`;
                }
                if (symbol(o, '{', true)) {
                    listof(o, constant_expression);
                    symbol(o, '}');
                }
            } else {
                // for now, just allow single literals or identifiers with simple operators
                const re = /^[~!+-]*([a-zA-Z_]\w*|0x[0-9a-fA-F_]+[dDfFlL]?|[0-9_]+e[+-]?[0-9_]+[dDfFlL]?|[0-9_]+(\.[0-9]*)?[dDfFlL]?|\.[0-9][0-9_]*[dDfFlL]?|'(\\u[0-9a-fA-F]{4}|\\.|.)'|"([^\\\n"]*\\.)*[^\n"]*")/;
                const m = o.source.match(re);
                if (!m) error();
                o.source = o.source.slice(m[0].length); stripwsc(o);
                exp = m[0];
            }
            for (;;) {
                if (symbol(o, '.', true)) {
                    const m = o.source.match(/^[a-zA-Z_]\w*/);
                    if (!m) error(o);
                    exp = `${exp}.${m[0]}`;
                    o.source = o.source.slice(m[0].length); stripwsc(o);
                }
                else if (symbol(o, '(', true)) {
                    let args = [];
                    if (!symbol(o, ')', true)) {
                        args = listof(o, constant_expression);
                        symbol(o, ')');
                    }
                    exp = `${exp}(${args.join(',')})`;
                }
                else if (symbol(o, '[', true)) {
                    exp = `${exp}[${constant_expression(o)}]`;
                    symbol(o, ']');
                } else {
                    break;
                }
            }
            const opm = o.source.match(/^([*/%+-]|<<|>>>?|<=?|>=?|!=|==|&&?|\|\|?|\^|instanceof\b)/);
            if (opm) {
                o.source = o.source.slice(opm[0].length);
                stripwsc(o);
                return exp + ' ' + opm[0] + ' ' + constant_expression(o);
            }
            return exp;
        }
        function ident(o) {
            // java.lang.Class::getPackageName has a $ at the end
            const m = o.source.match(/^[a-zA-Z_][a-zA-Z0-9_]*\$?/);
            if (!m) error(o);
            o.source = o.source.slice(m[0].length);
            stripwsc(o);
            return m[0];
        }
        function dottedident(o, allow_wildcard) {
            let id = ident(o);
            while (regex(o, /^\.(?!\.)/, '.', true)) {
               if (allow_wildcard && symbol(o,'*',true)) {
                  id += '.*'; break;
               }
               id += '.' + ident(o);
            }
            return id;
        }
        function gentypeparam(o) {
            const tn = symbol(o, '?', true)
                ? new TypeName('?', '\\*')
                : typename(o);

            const bound = regex(o, /^(super|extends)\b/, 'super|extends', true);
            if (bound) {
                tn.boundtype = bound[1];
                tn.classbound = typename(o);
                tn.intfbounds = [];
                while (symbol(o, '&', true)) {
                    tn.intfbounds.push(typename(o));
                }
            }
            return tn;
        }
        const primsigs = { 'void':'V', 'int':'I', 'boolean':'Z', 'char':'C', 'byte':'B', 'long':'J', 'short':'S', 'float':'F', 'double':'D' };
        function typename(o) {
            const tn = new TypeName();
            const nameparts = [];
            for (;;) {
                nameparts.push(ident(o));
                if (symbol(o,'<',true)) {
                   tn.genparams[nameparts.length-1] = listof(o, gentypeparam);
                   symbol(o, '>');
                }
                if (!regex(o, /^\.(?!\.)/, '.', true)) break;
            }
            tn.simplename = nameparts.join('.');
            tn.sigstring = primsigs[tn.simplename] || ('[LT][^;]*'+nameparts.join('[/$]')+ (tn.genparams.length?'<.*>':'') + ';');
            while (symbol(o,'[',true)) {
               symbol(o,']');
               tn.simplename+='[]';
               tn.sigstring = '\\['+tn.sigstring;
            }
            // even though varagrs are only allowed on final parameter declarations, include them in all types
            if (symbol(o,'...',true)) {
               tn.varargs = true;
               tn.simplename+='[]';
               tn.sigstring = '\\['+tn.sigstring;
            }
            return tn;
        }
        function parameterdecl(o) {
           const pdecl = {};
           pdecl.mods = has_text(o,'final') ? 'final': '',
           pdecl.type = typename(o);
           pdecl.name = ident(o);
           // allow Java's stupid rule of array brackets after name
           while (symbol(o,'[',true)) {
               symbol(o,']');
               pdecl.type.simplename+='[]';
               pdecl.type.sigstring = '\\['+pdecl.type.sigstring;
           }
           return pdecl;
        }
        function enum_value(o, data) {
           const enumdescription = format_description_comment();
           const enumname = ident(o), enumval = {
              name: enumname,
              isenum: true,
              isfield: true,
              outertype: data.enumtype,
              fqtn: data.enumtype.fqtn + '.' + enumname,
              description: enumdescription,
           };
           if (symbol(o,'(',true)) {
             if (!symbol(o,')',true)) {
                enumval.parameters = listof(o, constant_expression);
                symbol(o,')');
             }
           }
           if (symbol(o,'{',true)) {
             enumval.decls = [];
             while (!symbol(o,'}',true)) {
                if (ignoresc(o))
                    continue;
                const decl = {
                    declorder: enumval.decls.length
                };
                enumval.decls.push(decl);
                if (/^((public|protected|private|static|final|abstract|strictfp)\b\s*)*(class|@?interface|enum)\b/.test(o.source)) {
                    parse_type(o, decl, enumval);
                } else {
                    parse_fmc(o, enumval, decl);
                }
             }
           }
           return enumval;
        }
        function listof(o, fn, data) {
            const list = [ fn(o, data) ];
            while (symbol(o, ',', true)) {
               list.push( fn(o, data) );
            }
            return list;
        }
        function skip_scope(o) {
            symbol(o,'{');
            let balance = 1, nextbrace;
            while(balance) {
               nextbrace = skip_until(o, /[{}]/);
               (nextbrace==='{')?balance++:balance--;
            }
        }
        function skip_until(o, re) {
           for(;;) {
              const textmatch = o.source.match(re);
              if (!textmatch) error();
              const other = textmatch.index>0 && o.source.match(/\/[\/*]|["'({]/);
              if (other && other.index < textmatch.index) {
                      switch(other[0][0]) {
                          case '/':
                              o.source = o.source.slice(other.index);
                              stripwsc(o);
                              continue;
                          case "'":
                              o.source = o.source.slice(other.index);
                              const char = o.source.match(/^'(\\u[0-9a-fA-F]{4}|\\.|.)'/);
                              o.source = o.source.slice(char[0].length);
                              continue;
                          case '"':
                              o.source = o.source.slice(other.index);
                              const str = o.source.match(/^"([^\\\n"]*\\.)*[^\n"]*"/);
                              o.source = o.source.slice(str[0].length);
                              continue;
                          case '(':
                              o.source = o.source.slice(other.index+1);
                              stripwsc(o);
                              skip_until(o, /\)/);
                              continue;
                          case '{':
                              o.source = o.source.slice(other.index+1);
                              stripwsc(o);
                              skip_until(o, /\}/);
                              continue;
                      }
              }
              o.source = o.source.slice(textmatch.index + textmatch[0].length);
              stripwsc(o);
              return textmatch[0];
           }
        }
        function format_description_comment() {
            //const desc = (o.lastmlc||'').replace(/^\/\*+|\n\s*\**\s*|\**\/$/g,' ').trim();
            //return desc;
            const desc = (o.lastmlc||'').replace(/^\/\*[ \t]*\**|\s*\*+\/|\n[ \t]*\**/g,'\n').trim();
            return desc;
        }
        function parse_type(o, type, outertype) {
            type.unit = o;
            type.description = format_description_comment();
            // type modifiers
            type.mods = [];
            for (;;) {
                const typemod = regex(o, /^(public|protected|private|static|final|abstract|strictfp)\b/, 'modifier', true);
                if (!typemod) break;
                type.mods.push(typemod[1]);
            }
            type.mods = type.mods.join(' ');

            // type name + type variables
            const typedecl = regex(o, /^(class|@?interface|enum)\b/, 'type');
            type.reftype = typedecl[1];
            type.name = ident(o);
            if (symbol(o,'<',true)) {
               type.typevars = listof(o, gentypeparam);
               symbol(o, '>');
            }
            type.outertype = outertype;
            type.fqtn = (outertype?outertype.fqtn+'.':o.package?o.package+'.':'')+type.name;
            // console.log('type %s', type.fqtn);
            type.istype=true;
            type.decls=[];
            
            // ignore annotations
            if (type.reftype==='@interface') {
                //console.log('IGNORING annotation: '+type.name);
                skip_scope(o);
                ignoresc(o);
                return;
            }

            // optional extends
            if (has_text(o, 'extends')) {
                type.extends = listof(o, typename);
            }

            // optional implements
            if (has_text(o, 'implements'))
                type.implements = listof(o, typename);

            symbol(o,'{');
            while (!symbol(o, '}', true)) {
                // special case for enums
                if (type.decls.length===0 && type.reftype==='enum') {
                    let do_class_decls = false;
                    for(;;) {
                        const enumvalue = enum_value(o, {enumtype:type});
                        type.decls.push(enumvalue);
                        if (do_class_decls = symbol(o,';',true)) break;
                        if (symbol(o,',',true)) {
                            if (do_class_decls = symbol(o,';',true)) break;
                            if (/^[a-zA-Z_]/.test(o.source)) continue;
                        }
                        break;
                    }
                    if (do_class_decls) continue;
                    symbol(o,'}');
                    break;
                }
                if (ignoresc(o))
                    continue;
                const decl = lastdecl = {
                    declorder: type.decls.length
                };
                type.decls.push(decl);
                if (/^((public|protected|private|static|final|abstract|strictfp)\b\s*)*(class|@?interface|enum)\b/.test(o.source)) {
                    parse_type(o, decl, type);
                } else {
                    parse_fmc(o, type, decl);
                }
            }
            ignoresc(o);
        }
        function parse_fmc(o, type, decl) {
            decl.description = format_description_comment();
            decl.mods = '';
            for (;;) {
                // decl modifiers - default is now used for interface methods (since Java 8)
                const mods = o.source.match(/^((public|protected|private|static|final|abstract|native|transient|volatile|synchronized|strictfp|default)\b\s*)*/);
                if (!mods[0]) break;
                decl.mods = (decl.mods +' ' + mods[0]).trim().replace(/\s+/g, ' ');
                o.source = o.source.slice(mods[0].length);
                stripwsc(o);
            }
            if (symbol(o,'{',true)) {
                decl.isiniter = true;
                let balance = 1, nextbrace;
                while(balance) {
                   nextbrace = skip_until(o, /[{}]/);
                   (nextbrace==='{')?balance++:balance--;
                }
                return;
            }

            if (symbol(o,'<',true)) {
               decl.gentypeparams = listof(o, gentypeparam);
               symbol(o, '>');
            }
            
            decl.type = typename(o);
            if (symbol(o,'(',true)) {
               decl.isconstructor = true;
               decl.parameters = [];
               if (!symbol(o,')',true)) {
                   decl.parameters = listof(o, parameterdecl);
                   symbol(o, ')');
               }
               if (has_text(o, 'throws'))
                   decl.throws = listof(o, typename);
               if (!symbol(o,';',true))
                   skip_scope(o);
               const sigmatch = '\\('+decl.parameters.map(p => p.type.sigstring).join('')+'\\)V';
               decl.sigre = new RegExp('^'+sigmatch+'$');
               return;
            }
            decl.name = ident(o);
            if (symbol(o,'(',true)) {
               decl.ismethod = true;
               decl.parameters = [];
               if (!symbol(o,')',true)) {
                   decl.parameters = listof(o, parameterdecl);
                   symbol(o, ')');
               }
               // ffs. java also allows return type array brackets *after* the parameters. Why????
               while (symbol(o, '[', true)) {
                   symbol(o, ']');
                   decl.type.simplename += '[]';
                   decl.type.sigstring = '\\[' + decl.type.sigstring;
               }
               if (has_text(o, 'throws'))
                   decl.throws = listof(o, typename);
               if (!symbol(o,';',true))
                   skip_scope(o);
               const sigmatch = '\\('+decl.parameters.map(function(x){return x.type.sigstring}).join('')+'\\)'+decl.type.sigstring;
               decl.sigre = new RegExp('^'+sigmatch+'$');
               return;
            }
            decl.isfield = true;
            skip_until(o, /;/);
        }
        

        const o = {
           package:'', // ''=default package (null = no package)
           imports:[],
           topleveltypes:[],
           source:source,
        };

        try {
            // start of file
            stripwsc(o);
            while (symbol(o, ';', true)) { }

            // optional package
            if (has_text(o, 'package')) {
               o.package = dottedident(o);
               symbol(o,';');
            }
            while (symbol(o, ';', true)) { }

            // imports
            while (has_text(o, 'import')) {
               o.imports.push({
                  static: has_text(o, 'static'),
                  name: dottedident(o, true),
                  declorder: o.imports.length,
               });
               symbol(o,';');
            }

            // topleveltypes
            while (o.source) {
               while (symbol(o, ';', true)) { }
               const type = { declorder: o.topleveltypes.length };
               o.topleveltypes.push(type);
               parse_type(o, type);
            }
            // reset the source before we return
            //o.source = source;

        } catch (ex) {
            console.log(ex.stack);
            o.error = ex;
        }

        return o;
    }

    /*
        o: {
            java_sources: java_sources,
            additional_mtis: o.resource_mtis,
        };
        returns: promise(java_mtis, java_src_lib)
    */
   static async generate_java_mtis(o, JavaResolver) {
        // convert the Java source files to mti's
        // - we use a fast, perfect-syntax parser to generate a JSON represention of each Java source file
        // so we can use easily query it
        const java_mtis = [];
        for (let i=0; i < o.java_sources.length; i++) {
            const f = o.java_sources[i];
            const javaparser = FJP.java_to_json(f.content);
            if (javaparser.error) {
                console.log('Parse Error: %s, %s', f.name, javaparser.error);
                process.exit(1);
            }
            // create all the types first so we can resolve correctly
            function create_type(jp, outermti, t) {
                const mti = outermti ?
                    JavaResolver.newinnerobjtype(outermti, {
                        mods: t.mods,
                        type: t.type,
                        name: t.simplename,
                    })
                    :
                    JavaResolver.newobjtype({
                       name:t.simplename, 
                       pkg:jp.package, 
                       mods:t.mods,
                    });
                mti.it[0].extra = { unit:jp, parsedtype:t };
                java_mtis.push(mti);
                t.decls.forEach(function(d) {
                    if (!d.istype) return;
                    create_type(jp, mti, d);
                });
            }
            javaparser.topleveltypes.forEach(function(t) {
                create_type(javaparser, null, t);
            });
        }

        const all_mtis = java_mtis.slice().concat(o.additional_mtis);
        const java_src_lib = JavaResolver.createAppSourceLibrary(null, all_mtis);
        let promises = [], prm;
 
        // once we reach here, we've constructed all the types for this App.
        // we now need to flesh out the mti's with the rest of the parsed type information
        for (let i=0; i < java_mtis.length; i++) {
            const mti = java_mtis[i], jp = mti.it[0].extra.unit, pt = mti.it[0].extra.parsedtype;
            // always add the implicit on-demands from the current package first and java.lang last
            console.log('Creating MTI: ' + java_mtis[i].it[0].n);
            const imports = jp.imports.slice();
            if (jp.package)
                imports.unshift({name:jp.package+'.*'});
            imports.push({name:'java.lang.*'});

            // sort out extends and implements
            switch(pt.reftype) {
                case 'class':
                    // single extends, default=java.lang.Object
                    if (pt.extends) {
                        prm = JavaResolver.parsedTypeToMTI(pt.extends[0], mti, java_src_lib, imports, mti)
                            .then(function(extends_mti, mti) {
                                console.log('Setting extends: ' + extends_mti.it[0].n);
                                mti.it[0].e = JavaResolver.gettyperef(mti, extends_mti);
                            });
                        promises.push(prm);
                    } else mti.it[0].e = JavaResolver.ptypes.refs.Object;
                    // multiple implements
                    for (let j=0; j<(pt.implements||[]).length; j++) {
                        prm = JavaResolver.parsedTypeToMTI(pt.implements[0], mti, java_src_lib, imports, mti)
                            .then(function(implements_mti, mti) {
                                console.log('Adding implements: ' + implements_mti.it[0].n);
                                mti.it[0].i.push(JavaResolver.gettyperef(mti, implements_mti));
                            });
                        promises.push(prm);
                    }
                    break;
                case '@interface':
                    break;
                case 'interface':
                    // optional multiple extends, no implements
                    mti.it[0].e = [];
                    for (let j=0; j<(pt.extends||[]).length; j++) {
                        prm = JavaResolver.parsedTypeToMTI(pt.extends[0], mti, java_src_lib, imports, mti)
                            .then(function(extends_mti, mti) {
                                console.log('Adding extends: ' + extends_mti.it[0].n);
                                mti.it[0].e.push(JavaResolver.gettyperef(mti, extends_mti));
                            });
                        promises.push(prm);
                    }
                    break;
                case 'enum':
                    // extend from java.lang.Enum<E>, no implements
                    const enum_super_type = FJP.get_enum_superclass_typename(pt);
                    prm = JavaResolver.parsedTypeToMTI(enum_super_type, mti, java_src_lib, imports, mti)
                        .then(function(extends_mti, mti) {
                            console.log('Setting extends: ' + extends_mti.it[0].n);
                            mti.it[0].e = JavaResolver.gettyperef(mti, extends_mti);
                        });
                    promises.push(prm);
                    break;
            }
            for (let j=0; j < pt.decls.length; j++) {
                const decl = pt.decls[j];
                if (decl.istype) continue;
                if (decl.isfield) {
                    prm = JavaResolver.parsedTypeToMTI(decl.type, mti, java_src_lib, imports, {mti:mti,decl:decl})
                        .then(function(field_type_mti, x) {
                            // create the field
                            console.log('Adding field: '+x.decl.name +' to type: '+x.mti.it[0].n);
                            JavaResolver.add_field(x.mti, {
                                mods: x.decl.mods,
                                name: x.decl.name,
                                field_type_mti: field_type_mti,
                            });
                        });
                    promises.push(prm);
                }
                if (decl.ismethod) {
                    const method_types = decl.parameters.map(function(x){return x.type});
                    method_types.unshift(decl.type);
                    prm = JavaResolver.parsedTypeToMTI(method_types, mti, java_src_lib, imports, {mti:mti,decl:decl})
                        .then(function(mtis, x) {
                            // build up the parameters
                            const params = [];
                            for (let i = 1; i < mtis.length; i++) {
                                params.push({
                                    mods: x.decl.parameters[i-1].mods,
                                    param_type_mti: mtis[i],
                                    name: x.decl.parameters[i-1].name,
                                });
                            }
                            // create the method
                            console.log('Adding method: '+x.decl.name +' to type: '+x.mti.it[0].n);
                            JavaResolver.add_method(x.mti, {
                                mods: x.decl.mods,
                                name: x.decl.name,
                                method_type_mti: mtis[0],
                                parameters: params,
                            });
                        });
                    promises.push(prm);
                }
                if (decl.isconstructor) {
                    const method_types = decl.parameters.map(function(x){return x.type});
                    prm = JavaResolver.parsedTypeToMTI(method_types, mti, java_src_lib, imports, {mti:mti,decl:decl})
                        .then(function(mtis, x) {
                            // build up the parameters
                            const params = [];
                            for (let i = 0; i < mtis.length; i++) {
                                params.push({
                                    mods: x.decl.parameters[i].mods,
                                    param_type_mti: mtis[i],
                                    name: x.decl.parameters[i].name,
                                });
                            }
                            // create the method
                            console.log('Adding constructor to type: '+x.mti.it[0].n);
                            JavaResolver.add_constructor(x.mti, {
                                mods: x.decl.mods,
                                parameters: params,
                            });
                        });
                    promises.push(prm);
                }
            }
        }

        await Promise.all(promises);
        return {
            java_mtis,
            java_src_lib,
        };
    }
}

class TypeName {

    simplename = '';

    /**
     * Regex definition for type matching
     */
    sigstring = '';

    /** @type {*[]} */
    genparams = [];

    /** @type {'super'|'extends'} */
    boundtype = null;

    /** @type {TypeName} */
    classbound = null;

    /** @type {TypeName[]} */
    intfbounds = [];

    varargs = false;

    constructor(simplename = '', sigstring = '') {
        this.simplename = simplename;
        this.sigstring = sigstring;
    }
}

module.exports = FJP;
