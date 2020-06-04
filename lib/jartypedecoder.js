const JAR_SIG_BYTES = 'CA.FE.BA.BE'
    .split('.')
    .map(hexbyte => parseInt(hexbyte, 16));

function u1(info) {
    return info.buf[info.idx++];
}
function u2(info) {
    return (info.buf[info.idx++]*256)+info.buf[info.idx++];
}
function u4(info) {
    let j = 0;
    for (let i=0; i < 4; i++) {
        j = (j << 8) + info.buf[info.idx++];
    }
    return j;
}

function f4(info) {
    info.idx+= 4;
    return 0;
}

function i4(info) {
    let j = 0;
    for (let i=0; i < 4; i++)
        j = (j << 8) + info.buf[info.idx++];
    if (j > 2147483647)
        j -= 4294967296;
    return j;
}

function l8(info) {
    let j = '0x';
    for (let i=0; i < 8; i++)
        j += ('0'+info.buf[info.idx++].toString(16)).slice(-2);
    return j;
}

function d8(info) {
    info.idx+= 8;
    return "0.00000000";
}

function strlit(info) {
    let strlen = u2(info), s = '';
    while (strlen--)
        s+= String.fromCharCode(u1(info));
    return s;
}

function chunk(info, count) {
    const x = [];
    while(count--)
        x.push(info.buf[info.idx++]);
    return x;
}

function jar_signature(info) {
    for (let i=0; i < 4; i++) {
        if (JAR_SIG_BYTES[i] !== info.buf[i])
            throw new Error('Invalid signature');
    }
    info.idx = 4;
}

function jar_version(info) {
    info.jar.version = {
        minor: u2(info),
        major: u2(info),
    }
}

function constant_pool(info) {
    const poolcount = u2(info);
    const cp = info.jar.constpool = [];
    for (let i=0; i < poolcount-1; i++) {
        let x, tag;
        switch(tag=u1(info)) {
            case 1: x = strlit(info); break;
            case 3: x = i4(info); break;
            case 4: x = f4(info); break;
            case 5: x = l8(info); break;
            case 6: x = d8(info); break;
            case 7: x = { 
                reftype:'class', idx:u2(info),
                getclassname:function(info) {
                    return info.jar.constpool[this.idx-1];
                }
             }; break;
            case 8: x = { 
                reftype:'string', idx:u2(info),
                getstring:function(info) { return info.jar.constpool[this.idx-1]; }
             }; break;
            case 9: x = { 
                reftype:'field', clsidx:u2(info), ntidx:u2(info),
                getclassname:function(info) { return info.jar.constpool[this.clsidx-1].getclassname(info); },
                getname:function(info) { return info.jar.constpool[this.ntidx-1].getname(info); },
                gettype:function(info) { return info.jar.constpool[this.ntidx-1].getsig(info); },
             }; break;
            case 10: x = { 
                reftype:'method', clsidx:u2(info), ntidx:u2(info),
                getclassname:function(info) { return info.jar.constpool[this.clsidx-1].getclassname(info); },
                getname:function(info) { return info.jar.constpool[this.ntidx-1].getname(info); },
                getsig:function(info) { return info.jar.constpool[this.ntidx-1].getsig(info); },
             }; break;
            case 11: x = { 
                reftype:'intfmethod', clsidx:u2(info), ntidx:u2(info),
                getclassname:function(info) { return info.jar.constpool[this.clsidx-1].getclassname(info); },
                getname:function(info) { return info.jar.constpool[this.ntidx-1].getname(info); },
                getsig:function(info) { return info.jar.constpool[this.ntidx-1].getsig(info); },
             }; break;
            case 12: x = { 
                nameidx:u2(info), sigidx:u2(info),
                getname:function(info) { return info.jar.constpool[this.nameidx-1]; },
                getsig:function(info) { return info.jar.constpool[this.sigidx-1]; },
             }; break;
            case 15: x = { 
                typedesc:u1(info), mhidx:u2(info),
                getmethodhandle:function(info) { return info.jar.constpool[this.mhidx-1]; },
             }; break;
            case 16: x = { 
                typeidx:u2(info),
                gettype:function(info) { return info.jar.constpool[this.typeidx-1]; },
            }; break;
            case 18: x = { 
                bootstrapidx:u2(info), ntidx:u2(info),
                getname:function(info) { return info.jar.constpool[this.ntidx-1].getname(info); },
                getsig:function(info) { return info.jar.constpool[this.ntidx-1].getsig(info); },
            }; break;
            default: throw new Error('Unsupported constant pool tag: ' + tag);
        }
        x['n'] = i+1;
        info.jar.constpool.push(x);
        // long and doubles need a phantom entry
        if (tag===5||tag===6) info.jar.constpool.push(null), ++i;
    }
    // once the complete table has been scanned, resolve the indexes
    for (let i=0; i < poolcount-1; i++) {
        if (!cp[i] || typeof(cp[i]) !== 'object') continue;
        ['getstring','getname','getsig','getclassname','gettype'].forEach(fn => {
            if (cp[i][fn])
                cp[i][fn.slice(3)] = cp[i][fn](info);
        });
    }
}

function cp(info, idx, name) {
    const entry = info.jar.constpool[idx-1];
    if (!name) return entry;
    return entry[name] || entry['get'+name](info);
}

function mods(info) {
    const x = u2(info);
    return { bits: x, value:'0x'+('000'+x.toString(16)).slice(-4) };
}

function attributes(info) {
    const attribs = [];
    for (let i=0,acount=u2(info); i < acount; i++) {
        const a = {
            name: cp(info, u2(info)),
            /** @type {*[]|string} */
            info: chunk(info, u4(info)),
        }
        if (a.name === 'Signature')
            a.Signature = cp(info, (a.info[0]<<8)+a.info[1]);
        if (a.name === 'Code') {
            a.info = Buffer.from(a.info).toString('base64');
        }
        attribs.push(a);
    }
    return attribs;
}

function fields(info) {
    const flds = [], fcount = u2(info);
    for (let i=0; i < fcount; i++) {
        const f = {
            mods: mods(info),
            name: cp(info, u2(info)),
            type: cp(info, u2(info)),
            attributes:attributes(info),
        }
        flds.push(f);
    }
    return flds;
}

function methods(info) {
    const mthds = [], mcount = u2(info);
    for (let i=0; i < mcount; i++) {
        const m = {
            mods: mods(info),
            name: cp(info, u2(info)),
            sig: cp(info, u2(info)),
            attributes:attributes(info),
        }
        mthds.push(m);
    }
    return mthds;
}

function superinterfaces(info) {
    const intfs = [], icount = u2(info);
    for (let i=0; i < icount; i++)
        intfs.push(cp(info, u2(info), 'classname'));
    return intfs;
}

function superclass(info) {
    const idx = u2(info);
    if (idx===0) return null;   // java.lang.Object
    return cp(info, idx, 'classname');
}

class JarClassDecoder {
    static decode_class(classbytes, opts) {
        const info = {
            buf:classbytes, idx:0, 
            jar:{},
        };
        jar_signature(info);
        jar_version(info);
        constant_pool(info);
        info.jar.mods = mods(info);
        info.jar.thisclass = cp(info, u2(info), 'classname');
        info.jar.superclass = superclass(info);
        info.jar.interfaces = superinterfaces(info);
        info.jar.fields = fields(info);
        info.jar.methods = methods(info);
        info.jar.attributes = attributes(info);
        opts && opts.print && console.dir(info.jar, {depth:null});
        return info.jar;
    }

    static decode_class_file(fpn, opts) {
        const classdata = require('fs').readFileSync(fpn);
        this.decode_class(classdata, opts);
    }

    static find_signature_attr(info, attrs) {
        for (let i=0; i < attrs.length; i++) {
            if (attrs[i].name==='Signature')
                return attrs[i].Signature;
    //        if (attrs[i].name==='Signature' && attrs[i].info.length===2)
    //            return cp(info, (attrs[i].info[0]<<8) + attrs[i].info[1]);
        }
    }
}

if (module['filename'] === process.argv[1]) {
    JarClassDecoder.decode_class_file(process.argv[2], {print:true});
}

module.exports = JarClassDecoder;
